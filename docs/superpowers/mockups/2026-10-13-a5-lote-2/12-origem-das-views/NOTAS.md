# Mockup 12: de onde vêm as views (notas do desenho, 13/10/2026)

Abrir: `cd docs/superpowers/mockups/2026-10-13-a5-lote-2/12-origem-das-views && python3 -m http.server 47711 --bind 127.0.0.1`, depois `http://127.0.0.1:47711/index.html` (ou o arquivo direto do disco). A barra recolhida no topo ("Estados do mockup") troca **Estado** (inclui, desde a r1, **Carregando** e **Origem em revisão**), **Tela** (página do vídeo, página do canal, cartão da comparação), **Quem lê** (só no estado só leitura) e **Tema**. Parâmetros: `?estado=tipico|extremo|magro|zero|nao-medido|vazio|erro|leitura|carregando|revisao&tela=video|canal|cartao&periodo=7|28|90|tudo&leitura=sem-termos|so-total&tema=claro` (o `pais=mes` ainda existe só pela URL, fora da fila de aprovação: ver decisão 9). Todo número, termo, site e país é **exemplo**; hoje é 13/10/2026, o último dia entregue é 11/10 e a coleta de origem, aparelho, país e inscritos começa em 04/10 (suposição: deploy menos 10 dias). Capturas em `shots/` (`<caso>-<1440|390>-<escuro|claro>.png`, 33 casos desde a r3; as `r1-*`, `r2-*` e `r3-*.png` são dos revisores), medidas em `medidas.json`, script em `capturar-12.mjs`; `verificar-coerencia.mjs` abre 73 casos e confere pelo DOM que os números da mesma tela fecham (saída vazia de falhas = fecha). `PLANO.md` tem o plano feito antes do desenho.

Arquivos: `index.html`, `ov.js` (desenho), `ov-dados.js` (números que fecham por construção), `ov.css` (prefixo `ov-`), cópias congeladas de `a4.css`, `a4-comum.js`, `lote.css`, `lote.js` do lote 1 (nenhuma edição nelas).

## 1. Decisões de desenho e por quê

1. **Uma barra de 40 px que fecha com o total, e a última fatia é "omitido pelo YouTube".** O total (views dos dias medidos) = soma das origens + omitido, sempre; a tabela "A conta que fecha" fora da tela confere. O omitido é tracejado e vazado (nem zero, nem não medido, nem "ainda não existe") porque é uma quantidade conhecida, com largura, número e porcentagem. Nunca é repartido entre as outras fatias. Em canal pequeno ele domina a barra e a frase diz isso.
2. **O percentual diz sobre quê.** A coleta começa em 04/10, então "28 dias" tem 8 dias medidos. A régua de cobertura (hachura rosa antes da coleta, barra cinza nos dias medidos) fica acima da barra e a frase abre com "Nos 8 dias medidos (04/10 a 11/10), ...". Com cobertura total, a régua some e fica só a linha "7 de 7 dias com a origem medida".
3. **Cor só para a origem (e só dentro destes blocos: ver dúvida 8), símbolo sempre junto, textura nas duas que a cor sozinha confunde.** Pesquisa (azul-céu, lupa), sugeridos (violeta, losango), início e inscrições (coral, casa), Shorts (areia, raio), sites de fora (azul, seta que sai da caixa, **pontilhado**), outras (cinza, três pontos, **listrado**). A ordem é fixa em todo lugar. Nenhum matiz novo. Aparelho, país e inscritos usam uma cor só ("seu canal", laranja do lado O) porque o que muda é o comprimento; o significado é dado por ícone (aparelho), sigla (país) e símbolo de pessoa (inscritos: pessoa-visto e pessoa). Em inscritos a faixa que lidera é a cheia e a menor é a contornada, para que o destaque visual seja a resposta da frase (r1, C3).
4. **A lista é a legenda e a tabela.** Símbolo, nome, views, %. Sem segunda barra por linha. As porcentagens usam o maior resto, então sempre somam 100 e a frase nunca discorda da lista; valor positivo menor que 1% mostra "<1%" (nunca "0%").
5. **Valor 0 numa lista que tem "omitido" vira "—", não 0.** Regra do spec 7.3 (coberto, sem linha e soma abaixo do total = "zero ou abaixo do limiar"): o YouTube pode ter escondido aquela origem. O 0 de verdade (caixa vazada) só aparece quando o dia chegou e o omitido é 0 ou o total é 0. Vale também para termos e sites: com omitido na origem (estado magro) o bloco de sites diz “Nenhum site apareceu”, igual aos termos, e nunca “zero” (r1, B2).
6. **Janelas diferentes na mesma tela são ditas.** Origem, aparelho, país e inscritos valem desde 04/10; termos, sites e impressões por origem desde 08/09. Cada bloco tem a sua linha "Medido em N de M dias". A barrinha "com termo / sem termo" só aparece quando a origem cobre os mesmos dias; senão aparece "Sem comparar com o total da pesquisa" com a hachura.
7. **Termos e sites têm selo de cadeado "só quem edita o site"** (símbolo, não só cor) e a URL aparece sem nada depois do "?". Longas quebram em qualquer ponto (testado com 130 caracteres).
8. **Período longo (desde 2015):** a régua vira "faixa quebrada": um bloco hachurado comprimido (2015 até 03/10/2026, com o losango de 24/08/2026 dentro) e um bloco medido de 8 dias, separados por "//". Honesta: só 8 de 4.205 dias têm origem. A legenda diz "24/08/2026: o YouTube mudou como conta views". A marca também aparece em 90 dias (24/08 cai dentro da janela), proporcional.
9. **País por mês saiu da fila de aprovação** (r1, C5): a decisão 32 do dono (sem retroação) e o spec v2.3 (sem retroação não há linha de mês) excluem o dado de antes de 04/10. O desenho (selo "por mês", 3 meses fechados) fica só atrás de `?pais=mes`, para o caso de a retroação voltar; não tem botão, não tem captura e o dono não precisa olhá-lo. Ver dúvida 2.
10. **Só leitura tem duas variantes** (dúvida 1): vê o total e os detalhes menos termos e sites; ou vê só o total. Nos dois a tela diz o que ele não vê e quantos blocos são.
11. **O grupo novo inteiro leva o contorno tracejado verde-água "+ novo"**; "O que ainda não é medido" encolhe para a curva de retenção e diz que a linha de origem saiu dela.
12. **O cartão "Só o seu canal mede"** ganha cinco linhas com a marca "+ novo": origem (barra pequena com símbolos), termos, aparelho, país, inscritos. Cada linha tem as mesmas formas dos estados (hachura, caixa 0, pontilhado, tracejado, cadeado).
13. **Cobertura "parcial" convive com "zero".** O vídeo de 2019 do estado zero mede 7 dias com 0 view: caixa vazada com 0, uma por bloco, sem lista de seis zeros.
14. **Carregando e em revisão existem** (r1, C6). Carregando: esqueleto cinza liso (barra de 40 px com o mesmo contorno, três linhas, cada bloco com o rótulo “Carregando…” e o símbolo de seta circular), sem hachura rosa (“não chegou”) e sem pontilhado (“ainda não existe”); a animação é um pulso de opacidade e some com `prefers-reduced-motion`. Em revisão (spec 7.3, soma das origens maior que o total): o bloco da origem vira a forma “não medido” com o motivo “Em revisão”; os outros blocos têm a sua própria conta e seguem normais. O implementador decide o texto final com o leitor; o desenho existe para o dono ver que o estado não é zero.

## 2. Tabela de frases (texto exato; `{}` é número ou data)

| Onde | Texto |
|---|---|
| Título do grupo (cartão 1) | De onde vêm as views |
| Seletor | Período · 7 dias · 28 dias · 90 dias · Desde 2015 (vídeo: 7 dias · Desde a publicação) |
| Dica do seletor | Dados até {11/10}: o YouTube entrega com 2 a 3 dias de atraso. |
| Seletor lembrado | Escolha salva neste navegador. [Voltar ao padrão] |
| Frase da origem (típico) | Nos {8} dias medidos ({04/10} a {11/10}), **{42%}** das views vieram da pesquisa do YouTube e **{18%}** de vídeos sugeridos; {6%} foram omitidos pelo YouTube. (com 7 de 7 dias o prefixo "Nos N dias medidos" não aparece) |
| Frase da origem (omitido domina) | Nos 8 dias medidos (04/10 a 11/10), o YouTube disse a origem de só **5 views** das 14, e **9** foram omitidas: com poucas views por origem ele esconde quase tudo. |
| Frase (zero) | Nenhuma view nos {7} dias medidos ({05/10} a {11/10}): não há o que repartir. |
| Frase (não medido) | Ainda não sabemos de onde vêm as views: a coleta começa em {14/10}. |
| Cobertura | **{8} de {28}** dias com a origem medida · Não medido: a coleta começou em {04/10} · Medido · {24/08/2026}: o YouTube mudou como conta views |
| Cobertura (completa) | {7} de {7} dias com a origem medida, de {05/10} a {11/10} |
| Linhas | Pesquisa do YouTube · Vídeos sugeridos · Início e inscrições · Feed de Shorts · Sites e apps de fora · Outras origens · Omitido pelo YouTube |
| Dica do omitido | O YouTube contou estas views, mas não disse de onde vieram. [Onde há “—”, o YouTube não deu número: pode estar aqui dentro.] |
| Total | Total de views nos dias medidos |
| Rodapé do bloco | Views no período todo: {n}. A divisão acima usa só as {n} dos dias medidos. (r3, melhoria 3) |
| Impressões, título | Impressões por origem |
| Impressões, frase | Nos {34} dias medidos, seus vídeos foram mostrados **{12.920.000}** vezes; **{31%}** no feed de Shorts. |
| Impressões, omitido | Impressões que o relatório não separou por origem. · Total de impressões |
| Termos e sites, título | O que pesquisaram e de que sites vieram · selo: só quem edita o site |
| Termos, frase | A busca que mais trouxe gente foi **“{termo}”**, com {n} views. |
| Sites, frase | O site que mais trouxe gente foi **{endereço}**, com {n} views. |
| Com/sem termo | Das {256} views da pesquisa: {149} com termo, {107} omitidas pelo YouTube. (sites: "de sites de fora", "com endereço") |
| Sem comparar | Sem comparar com o total da pesquisa: a origem foi medida em {8} dos {34} dias desta lista. |
| Nenhum termo | **Nenhum termo apareceu.** O YouTube só mostra termos que trouxeram várias views; as {3} views da pesquisa ficaram sem termo (omitido pelo YouTube). |
| Aparelho | Em que aparelho · {66%} das views vieram de celular; {3%} omitido pelo YouTube. · Celular · Computador · TV · Tablet · Outros aparelhos |
| País | De que país · {74%} das views vieram de Brasil e {10%} de Portugal; {4%} omitido pelo YouTube. · Outros países · Não identificado · selo "por mês" · Medido por mês: julho, agosto e setembro de 2026. Outubro entra quando fechar. |
| Inscritos | Inscritos e não inscritos · {66%} das views vieram de quem não é inscrito; {5%} omitido pelo YouTube. · Inscritos · Não inscritos (a faixa líder é a cheia) |
| Rótulo do ⓘ (leitor de tela e cabeçalho do popover) | Como a origem é calculada · Como o aparelho é calculado · Como o país é calculado · Como inscritos e não inscritos são calculados · Como termos e sites são calculados |
| Medido (cartões) | Medido nos {7} dias · Medido em {8} de {90} dias; antes de {04/10} não medido |
| Não medido (origem) | pastilha "não medido" + A coleta começa em {14/10}. Antes dessa data não guardamos a origem; não é zero. (um texto por cartão: “a origem” na origem, “o aparelho”, “o país”, “quem é inscrito”) |
| Não medido (termos) | Ainda não temos termos nem sites: o relatório do YouTube não chegou. + Ainda não coletado: o relatório do YouTube ainda não chegou. Quando chegar, esta lista aparece sozinha. |
| Nenhum site / termo (com omitido na origem) | **Nenhum site apareceu.** O YouTube só mostra sites que trouxeram várias views. (termos: “…as {3} views da pesquisa ficaram sem termo”) |
| Carregando | Carregando a origem das views de {90 dias}… · Carregando as impressões por origem… · Carregando termos e sites… · Carregando… (cartões pequenos) |
| Em revisão | Não mostramos de onde vêm as views por enquanto: a origem está em revisão. + Em revisão: as origens somaram mais views do que o total do dia a dia, então não mostramos a divisão até conferir. Não é zero. |
| Zero medido (cartões pequenos) | **Zero medido.** Nenhuma view nos {7} dias medidos. (caixa 0 pequena em linha, não bloco) |
| Zero medido | **Zero medido.** O YouTube mandou os {7} dias e nenhuma view veio de lugar nenhum. (impressões: ...o vídeo não foi mostrado a ninguém: 0 impressões.) |
| Ainda não existe | **Ainda não existe.** O YouTube entrega a origem das views 2 a 3 dias depois da publicação. Primeira leitura em {15/10}. |
| Dado que você não vê | **Você não vê este dado.** Termos de pesquisa e sites de fora só aparecem para quem edita o site. + Aqui há duas listas que você não vê: **o que pesquisaram** e **de que sites vieram**. O resto desta página continua à sua vista. |
| Só o total | Views no período · Dado que você não vê · **Você não vê este dado.** De onde vêm as views, o que pesquisaram, aparelho, país, inscritos e impressões por origem são do dono do canal. + São **7 blocos** nesta página: ... O total acima continua à sua vista. |
| Erro | **Não conseguimos ler a origem das views agora.** O YouTube não respondeu à consulta das 14:32. O total de views da página continua certo; faltam origem, aparelho, país, inscritos, termos e sites. A última consulta que deu certo foi a de 12/10, às 06:10. [Tentar de novo] → "Tentando de novo… (no mockup a leitura continua falhando)" |
| O que ainda não é medido | Curva de retenção: ainda não é coletada. (a linha de aviso sobre a origem saiu: explicava uma mudança do produto, não ajudava a ler) |
| Cartão da comparação | Só o seu canal mede · Impressões, taxa de clique, origem das views e termos de pesquisa só chegam ao dono do canal. Leo Khev não tem esses números aqui porque o YouTube não os entrega, **não porque sejam zero**. · linhas novas: De onde vêm as views ({42%} da pesquisa do YouTube, {18%} de vídeos sugeridos) · Termos de pesquisa (só para quem edita) · Aparelho ({62%} em celular) · País ({70%} do Brasil) · Inscritos e não inscritos ({58%} de quem não é inscrito) |
| ⓘ da origem | Fonte: YouTube Analytics do seu canal, views de cada dia por tipo de origem. Cálculo do Observatório, somando só os dias medidos do período. · Cores: valem só dentro destes blocos; em outras telas as mesmas cores indicam faixas de desempenho, aqui o símbolo e a ordem fixa dizem qual é a origem. · Porcentagem: views da origem ÷ views desses mesmos dias (as do dia a dia do vídeo ou do canal). O total sempre fecha: a soma das origens mais o omitido é igual ao total. · Omitido pelo YouTube: o YouTube não informa origens com poucas views. A diferença entre o total e a soma das origens aparece como barra própria e nunca é repartida entre as outras. · Dias medidos: a coleta começou em {04/10/2026} e vai para a frente; os dias antes disso ficam como não medido, nunca como zero. · 24/08/2026: o YouTube mudou como conta views. Períodos que cruzam essa data não se comparam direto. |
| ⓘ de termos | ... Quem vê: só quem edita o site. Nada disto sai do painel. · Barras: aqui a barra cheia é o termo ou o site com mais views; em aparelho, país e inscritos a barra é a fatia do total. · Endereços: guardamos o site sem o que vem depois do “?”. · Termos: uma busca pode ser o nome de uma pessoa. Por isso ficam só aqui, nunca somados numa tela de leitura. |
| Rótulo de leitor de tela da barra, origem sem número (r2, B1) | {Origem}: sem número do YouTube, pode estar no omitido (nunca “0% (0)”; “0% (0)” só no estado zero, total 0) |
| Rótulo da régua de cobertura (r2, C8) | Origem medida em {8} de {4.205} dias, de {data} a {data}. (números com o mesmo separador da tela) |
| Tabela de referência, origem em revisão (r2, C7) | Views dos dias medidos {826} · Soma das origens (exemplo) {860} · Resultado: A soma passou do total em {34}: em revisão, a divisão não aparece. Nos estados não medido, erro, sem dado e carregando a tabela não aparece. |

## 3. Dúvidas ao dono (com o padrão adotado)

1. **Quem é "só leitura" aqui?** O spec diz duas coisas: 7.3 (termos e sites só para quem edita) e a v2.3 I11 (toda tabela do canal próprio só para quem tem o direito "ver desempenho privado"). Desenhei **as duas** (botão "Quem lê"). **Padrão: "sem editar" vê o total e os detalhes, sem termos nem sites**, que é o que o pedido descreve; a outra variante (só o total) é o que o RLS da v2.3 daria a quem não tem o direito. Pergunta: o direito "ver desempenho privado" dá termos e sites, ou termos e sites continuam só para quem edita?
2. **País por mês.** O spec v2.3 diz que sem retroação não existe linha de mês: se a API recusar `day,country`, a coleta daqui para a frente é uma consulta por dia. Então "por mês" só existiria se a retroação voltar. **Padrão (r1, C5): o mês saiu da fila de aprovação** (sem botão e sem captura; o desenho ficou só atrás de `?pais=mes`). Pergunta ao dono: confirmar que podemos apagar o mês de vez (a conferência 1 da E11 decide).
3. **A data de início da coleta.** Usei 04/10 (deploy menos 10 dias). A tela quase vazia por semanas é o estado real. **Padrão: a régua de cobertura e "N de M dias" em todo bloco**, sem esconder o que não existe. Pergunta: aceita ver uma régua cinza gigante mesmo com 7 de 7? **Adotei:** com cobertura total a régua vira uma linha de texto.
4. **Cor de "sites de fora" e "pesquisa" no claro.** `--tier-mid` e `--lado-b` ficam parecidos; separei por textura (pontilhado) e por distância na barra. Se o dono achar confuso, o próximo passo é trocar o externo por uma forma sem azul.
5. **Impressões por origem sem sites de fora.** Não existe miniatura fora do YouTube, então a linha de "sites e apps de fora" não aparece ali; dito no ⓘ. Padrão adotado: não mostrar a linha.
6. **Direção ("subiu em relação ao período anterior").** Não desenhei: sem série antes da coleta não há comparação honesta por semanas, e o dono não pediu. Pergunta: quer ▲ ▼ ＝ por origem depois de 28 dias de coleta?
7. **Taxa de clique por origem.** O pedido fala só de impressões por origem; não desenhei a taxa. O spec guarda os cliques estimados na tabela, então cabe depois.
8. **As cores da origem repetem cores que significam outra coisa no resto do produto (r1, C2).** Pesquisa usa o azul-céu de “mediano”, sugeridos o violeta de “alto”/“hábito”, início e inscrições o coral de “topo”, Shorts e sites de fora as cores dos lados de uma comparação. Nenhum matiz novo foi criado (regra da convenção), e aqui o símbolo, a ordem fixa e a lista dão leitura em escala de cinza. O ⓘ da origem diz que a cor vale só dentro destes blocos. **Padrão: aceitar.** Pergunta ao dono: aceita, ou prefere uma paleta própria da origem (um matiz novo por origem, decisão dele)?
9. **A 390 px a resposta fica abaixo da primeira dobra (r1, melhoria 8).** O cartão começa em y 940 porque o cabeçalho aprovado do vídeo empilha 6 células. Não mexi no cabeçalho. Pergunta: subir a frase-resumo para logo abaixo do seletor, fora do cartão, ou manter?
10. **Popover do ⓘ a 390 px sem botão de fechar (r1, melhoria 9).** É o padrão do produto (toque fora, Esc em teclado físico) e fica nas cópias congeladas do lote 1; a 390 px o popover ocupa quase metade da tela. Registro, sem mudança aqui.

## 4. O que o implementador precisa saber

- **Estado por bloco, não por página.** Cada bloco decide entre medido, zero, não medido, ainda não existe e dado que você não vê com a mesma função (`resolve` em `ov.js`): sem cobertura = não medido (com a data); cobertura e total 0 = zero medido; senão medido. Nunca devolver `0` ou nulo solto: o leitor devolve o estado como valor nominal (spec 7.3).
- **Total, soma e omitido** vêm de uma conta só: omitido = views do dia a dia dos dias medidos − soma das linhas (nunca negativo; se ficar negativo, o estado é "em revisão" do spec e a tela mostra "não medido: em revisão", desenhado desde a r1: estado “Origem em revisão”). A lista usa maior resto para somar 100.
- **Cobertura por conjunto:** origem, aparelho, país, inscritos têm uma (desde o ponto de partida da E11); termos, sites e impressões por origem têm outra (desde 08/09). Cada cartão tem a sua linha. A barrinha "com termo" só compara quando as duas janelas são iguais.
- **Privacidade:** termos e sites só pelo token de edição (`EdicaoDoSite`); URL sem query string e sem fragmento, cortada na escrita; nada disso no HTML nem no RSC de quem não tem o direito (item 41 do spec). A tela de só leitura não monta os blocos privados, só o aviso.
- **Mudança de contagem de 24/08/2026:** marca na régua sempre que a janela cruza a data (função única `countRuleOf` do spec 01). No período "desde 2015" a régua é dividida (comprimida + medida), nunca proporcional.
- **Acessibilidade:** a barra e a régua são `role="img"` com texto por extenso (`aria-label` lista cada origem com % e número); símbolos e miniaturas são `aria-hidden`; o ⓘ é `A.ibtn` com popover; o seletor é uma lista de links com `aria-current`; o erro é `role="alert"`. Sem rolagem horizontal a 390 px; alvo de 44 px no seletor e no botão de erro em toque (os ⓘ compactos de 28 px só em ponteiro fino, como no resto do produto).
- **Não verificado:** leitor de tela real, Safari, Opera (o navegador do dono) e ordem de teclado completa. O mockup não usa `color-mix()`; contraste de texto foi lido nas capturas, não medido com ferramenta (o revisor de UX mede).
- **Dívida declarada:** os três cartões pequenos a 1440 ficam em 3 colunas de cerca de 390 px; a barra de cada lista cresce com o número de linhas (país tem 8), então a coluna do país é mais alta que as outras.

## 5. Resposta à revisão r1 (13/10/2026, REVISAO-UX-r1.md)

Capturas refeitas nos 19 casos, 1440 escuro e 390 claro, e conferidas abertas (típico, magro, carregando, revisão, inscritos nos dois temas). Medido de novo: chips `.ov-sw.g` 26 x 26 com o símbolo em (5, 5) em todos os cartões e nos dois temas; seletor de período 44 px; zero rolagem horizontal; zero `color-mix()`.

| Item | O que foi feito |
|---|---|
| B1 | Corrigido: a classe `.lado` do desenho virou `.ov-own` (ov.css e ov.js), sem colisão com o cartão de lado do a4.css. Chips de frase, de termos e sites, aparelho, país e inscritos medem 26 x 26 com o símbolo centrado; a fatia “inscritos” deixou de herdar borda e padding. |
| B2 | Corrigido: com omitido na origem, “sites de fora” sem dado mostra a forma tracejada “Nenhum site apareceu. O YouTube só mostra sites que trouxeram várias views.” (igual aos termos). A caixa “0” de termos e sites só aparece quando a origem tem total 0 e omitido 0 (estado zero). Aparelho, país e inscritos do magro já usavam “—”. |
| C1 | Corrigido: um texto por cartão (“a origem”, “o aparelho”, “o país”, “quem é inscrito”). |
| C2 | Aceito como pergunta, não como bloqueio: colisão declarada na dúvida 8 com o padrão “aceitar”; o ⓘ da origem e o das impressões dizem que a cor vale só dentro destes blocos. Não criei matiz novo (regra da convenção). |
| C3 | Corrigido: a faixa que lidera é a cheia, a menor é a contornada; legenda igual; os símbolos de pessoa ficam. Quando os inscritos lideram, a inversão é automática. ⓘ explica. |
| C4 | Corrigido: “Como o aparelho é calculado”, “Como o país é calculado”, “Como inscritos e não inscritos são calculados”; o mesmo texto no cabeçalho do popover. |
| C5 | Corrigido: o botão “País por mês” saiu da barra de estados e a captura foi apagada; dúvida 2 ficou na NOTAS (decisão 9). |
| C6 | Desenhados: “Carregando” (esqueleto liso, nem hachura nem pontilhado) e “Origem em revisão” (forma “não medido” com o motivo); ambos na barra de estados e nas capturas, mais o cartão da comparação em revisão. |
| Sug. 1 | Feito: a linha de aviso sobre a origem saiu de “O que ainda não é medido”. |
| Sug. 2 | Feito: barra, lista, régua e esqueleto com a mesma largura máxima de 760 px. |
| Sug. 3 | Feito em parte: nos três cartões pequenos o zero vira uma linha com a caixa “0” pequena, não um bloco. O bloco “0” grande fica só nos blocos largos (origem, impressões). |
| Sug. 4 | Feito: quando o omitido passa de 50%, o símbolo da frase é o do omitido. |
| Sug. 5 | Feito: uma linha no ⓘ de termos e sites, aparelho e país sobre a escala das barras. |
| Sug. 6 | Feito: “relatório em lote” e “forja e Cowork” saíram; “leitura das 14:32” virou “consulta das 14:32”; fonte monoespaçada só nos números de “8 de 28”. |
| Sug. 7 | Feito: seletor de período com 44 px em todas as larguras. |
| Sug. 8, 9 | Não mudam o desenho; viraram dúvidas 9 e 10 ao dono (o cabeçalho do vídeo é aprovado; o popover é padrão do produto em arquivo congelado). |

Discordância: nenhuma. Na C2 a intenção do revisor (cor estável por significado) é atendida com símbolo, ordem fixa e a pergunta ao dono, porque trocar cor exigiria matiz novo, que a convenção proíbe sem decisão dele.

## 6. Resposta à revisão r2 (13/10/2026, REVISAO-UX-r2.md)

Capturas refeitas nos 19 casos (1440 escuro, 390 claro), conferidas abertas no magro (390), na revisão (1440) e no recorte dos inscritos; `ov.js` é o único arquivo de desenho alterado. `aria-label` relido no DOM em magro, extremo, típico, revisão, não medido e erro. Medidas: 0 px de rolagem, 0 fontes abaixo de 12 px, sem erro de página (só a fonte externa bloqueada de propósito).

| Item | O que foi feito |
|---|---|
| B1 | Corrigido em `origemLista` (`ov.js`): origem que a lista mostra como “—” (valor 0 com omitido maior que 0) vira “{origem}: sem número do YouTube, pode estar no omitido” no rótulo da barra, nas origens e nas impressões. “0% (0)” só aparece no estado zero. Conferido no magro: as quatro origens sem número dizem isso; Pesquisa 22% (3) e Sugeridos 14% (2) seguem com número. |
| C7 | Corrigido: na revisão a tabela de referência mostra a soma que passou do total (860 contra 826, 34 a mais) e diz “em revisão, a divisão não aparece”; em não medido e erro a tabela some, como já era em sem dado e carregando. |
| C8 | Corrigido: o rótulo da régua usa o mesmo formatador da tela (“8 de 4.205 dias”). |
| Sug. 1 | Feito: a fatia de inscritos mostra o símbolo a partir de 5% (era 8%); no magro, a fatia de 7% tem o ícone, conferido a 390 px. |
| Sug. 2 | Registrado, não mudado: o estado zero abre sem chip de propósito, porque não há origem a simbolizar; o bloco “0” vazado logo abaixo já faz o papel do símbolo. |
| Sug. 3 | Pergunta ao dono, não mudança: aparelho, país e inscritos seguem com o laranja do “seu canal” (com ícone, sigla e posição). Se parecer monocromático, a saída é usar a cor da origem. |
| Sug. 4 | Sem mudança: o símbolo, a ordem fixa e a lista separam as origens em tons de cinza. |
| Sug. 5 | Sem mudança: popover sem botão de fechar é padrão do produto (dúvida 10). |

Discordância: nenhuma.

## 7. Resposta à revisão r3 (13/10/2026, REVISAO-UX-r3.md)

Causa-raiz do B1: o cenário "não medido" reaproveitava a cobertura do típico (7 de 7) e só trocava a data por texto. Agora o cenário zera a cobertura (`D.COLETA_FUT` = 14/10, 0 dias medidos) e tudo o que a tela mostra deriva dela. Datas e taxas que estavam digitadas em mais de um lugar passaram a uma fonte só em `ov-dados.js` (`COLETA_FUT`, `VAZIO_PUB`, `PRIMEIRA`, `TAXA`, `ASSIST`, `MAG_DIA`).

| Item | O que foi feito |
|---|---|
| B1-r3 | Corrigido: no canal "Não medido" a quarta célula mostra o marcador "não medido" (hachura) e "0 de 7 · a coleta começa em 14/10"; nunca "7 de 7" nem a caixa do zero. Conferido nas capturas (1440 escuro e 390 claro). |
| Melhoria 1 (erro, canal) | Feito: célula "—" com "de 7 · não conseguimos ler agora". Carregando também usa "—" ("de 90 · carregando"). Revisão: "7" com "de 7 · origem em revisão". |
| Melhoria 2 (revisão, termos) | Feito: com a origem em revisão a barrinha "com termo / sem termo" sai e aparece "Sem comparar com o total da pesquisa: a origem está em revisão." (a conta de 256 deixou de depender da origem em revisão). |
| Melhoria 3 (magro, rodapé) | Feito, em todos os estados: "A divisão acima usa só as {n} dos dias medidos." (a sugestão literal "5 das 14" seria falsa fora do magro). |
| Melhoria 4 (legenda da tabela) | Feito: "canal, 7 dias", "video, 22 dias" em todas; vem de `C.per.dias`. |
| Melhoria 5 | Sem mudança: dúvida 8 e sug. 3 da r2 seguem como perguntas ao dono com o padrão "aceitar". |

Achados da varredura de coerência (a r3 não os citou; todos corrigidos):

| # | Estado | Contradição encontrada | Correção |
|---|---|---|---|
| V1 | Não medido | Impressões por origem "Medido nos 7 dias" ao lado de termos "o relatório do YouTube não chegou" (mesmo relatório em lote) | Impressões por origem também viram "não medido", com o mesmo motivo |
| V2 | Não medido | O ⓘ da origem dizia "a coleta começou em 04/10" sob um cartão que diz "começa em 14/10"; os ⓘ de impressões e termos diziam "desde 08/09" | Os ⓘ usam a mesma data da tela; nos termos e impressões dizem "o primeiro relatório do YouTube, que ainda não chegou" |
| V3 | Magro, 7 e 28 dias | Cabeçalho "36 views" sobre barra de "14" com 7 de 7 dias medidos (o total era fixo em 36 para qualquer período) | Views do magro vêm de um desenho dia a dia (`MAG_DIA`, 14 nos 8 dias medidos, 22 nos 82 antes): 7 dias = 12, 28 = 19, 90 = 36 |
| V4 | Magro | Termos "as 3 views da pesquisa" fixas; impressões 3.100 digitadas; views na janela de 34 dias fixas em 17 | Derivados: pesquisa na janela = 3/14 das views da janela; impressões = 91 por dia x 34 = 3.094 |
| V5 | Cartão da comparação (todos os estados) | As quatro linhas "como já era" eram texto fixo: 41.300 impressões na tela do magro (14 views), no extremo (361 mil views em 7 dias) e no zero (0 views) | Derivam do mesmo perfil: impressões, cliques (impressões x taxa), taxa e intervalo (1,96 x raiz de p(1-p)/n); zero mostra "Zero medido" e "sem impressões para dividir"; sem dado mostra "Ainda não existe" |
| V6 | Cartão, erro e carregando | As cinco linhas novas mostravam os números cheios com a leitura falhando ou ainda carregando | "Não conseguimos ler agora" (forma de erro) e "Carregando…" (forma lisa) |
| V7 | Cartão, zero | "Termos: nenhum termo apareceu: o YouTube omite..." sobre origem com zero views | "Zero medido: nenhuma view veio da pesquisa" |
| V8 | Vídeo, cabeçalho | "views 3870", "há 2709 dias" sem separador, enquanto o corpo dizia "3.870"; as views da vida inteira eram digitadas | Formatadas com o mesmo separador e derivadas do cenário "desde a publicação" |
| V9 | Vídeo antigo, desde a publicação (zero) | Régua proporcional de 8 em 2.708 dias virava um fio de 0,3% e sem ano nas datas | Usa a faixa quebrada do canal "desde 2015", com ano |
| V10 | Erro | A frase de falta não citava as impressões por origem | Citadas |
| V11 | Zero, cartão | Impressões 41.300 | 0 (ver V5) |

## 8. Tabela de coerência por estado (r3)

Regra: cada número tem uma origem só. `R` = views por dia dos dias medidos, `Rant` = views por dia dos dias anteriores à coleta (`ov-dados.js`, perfis `canalTip`, `videoTip`, `ext`); "período" = últimos N dias até 11/10 (último dia entregue); coleta de origem desde 04/10 (8 dias medidos até 11/10); relatório em lote desde 08/09 (34 dias até 11/10). `verificar-coerencia.mjs` confere por código: soma das linhas = total, porcentagens somam 100, cabeçalho x rodapé x régua x linhas "Medido em A de B", base dos termos = origem, cartão x página do canal em 7 dias. Última rodada: 73 casos, 0 falhas.

| Estado | Número na tela | De onde deriva | Fecha com |
|---|---|---|---|
| Típico, canal 7 dias | 3.185 views no período | R 455 x 7 dias (05/10 a 11/10) | cabeçalho = total da barra = "Views no período todo"; origens 1.338+573+478+319+223+76 + omitido 178 = 3.185; aparelho, país e inscritos somam 3.185 |
| | "7 de 7 dias" (célula, régua, 3 cartões) | cobertura da coleta no período | as cinco ocorrências dizem 7 de 7; sem prefixo "Nos N dias medidos" na frase |
| | 41.300 impressões | 5.900 x 7 dias | barra de impressões = linha do cartão da comparação; cliques 1.980 = 41.300 x 4,8% (dezena); intervalo 4,6% a 5,0% |
| | termos 829 + 509 = 1.338; sites 188 + 35 = 223 | janela do lote = janela da origem (7 = 7) | base = linha "Pesquisa" 1.338 e "Sites" 223 da barra; busca líder 216 = cartão |
| Típico, canal 28 | 11.640 no período; 3.640 medidos | 8 x 455 + 20 x 400; 8 x 455 | rodapé "Só... 3.640" (agora "A divisão acima usa só as 3.640"); "8 de 28" em célula, régua e cartões; impressões 28 x 5.900 = 165.200 |
| Típico, canal 90 / desde 2015 | 36.440 = 3.640 + 82 x 400; 1.842.600 informado | idem; perfil | "8 de 90" e "8 de 4.205" (4.205 = 08/04/2015 a 11/10/2026 inclusive); impressões em 34 dias = 200.600; termos sem comparação (8 dos 34 dias) |
| Típico, vídeo 7 dias / desde a publicação | 826 (118 x 7); 3.870 na vida; 944 medidos | 8 x 118 + 14 x 209 = 3.870 (cabeçalho, derivado do cenário) | "Views no período todo: 3.870" = cabeçalho; 22 dias desde 20/09; impressões 22 x 1.650 = 36.300; "há 23 dias" = 13/10 menos 20/09; engajamento (212+31)/3.870 = 6,3% |
| Extremo (canal) | 412.864 medidos = 51.608 x 8; 18.742.300 no período; 4.205 dias | perfil `ext` | soma das origens + omitido 12.387 = 412.864; impressões 34 x 380.000 = 12.920.000; cartão 7 x 380.000 = 2.660.000, cliques 127.680, intervalo com 2 casas (4,77% a 4,83%) |
| Magro (canal) | 7 dias 12; 28 dias 19; 90 dias 36; 8 dias medidos 14 | `MAG_DIA` = 2,1,3,2,1,2,2,1 (14) + 22 em 82 dias | cabeçalho = rodapé; "só 5 views das 14" (3+2); omitido 9 = 14-5; aparelho 4 + 10; país 5 + 9; inscritos 1 + 4 + 9; impressões 34 x 91 = 3.094; 7 dias: 637, cliques 31, intervalo 3,1% a 6,5%; termos: "as 3 views da pesquisa" (7 dias) / "as 5" (90 dias) |
| Zero medido (vídeo) | "nenhuma view nos 7 dias" (8 em "desde a publicação"); 41.200 no cabeçalho | R = 0 nos dias medidos; vida informada | caixa 0 em cada bloco, uma linha pequena nos cartões; impressões 0; termos e sites "Zero medido"; cartão: impressões 0, taxa "sem impressões para dividir", % assistido "sem views" |
| Não medido | célula "0 de 7" com o marcador; "a coleta começa em 14/10" | `COLETA_FUT` = 14/10, cobertura 0 | origem, impressões, termos e sites, aparelho, país, inscritos: todos "não medido"; ⓘ com a mesma data; sem tabela de referência; "views no período 3.185" continua (a views do dia a dia existem) |
| Sem dado ainda | publicado 12/10, 187 views (r6); "primeira leitura em 15/10" | `VAZIO_PUB` + 3 dias | engajamento (9+1)/187 = 5,3%; nenhum número de origem; cartão: as quatro linhas antigas também "Ainda não existe" |
| Erro | "—" na célula; texto cita sete faltas | sem leitura | total de views (3.185 ou 3.870) continua e é o mesmo do típico; cartão: cinco linhas "Não conseguimos ler agora", linhas antigas normais |
| Carregando | "—" na célula ("de 90 · carregando"); 36.440 no cabeçalho | período 90, sem leitura | esqueletos lisos; cartão "Carregando…" |
| Origem em revisão | célula "7 de 7 · origem em revisão"; tabela: 826 contra 860 (34 a mais) | soma que passou do total | impressões e termos seguem; termos sem comparar com a pesquisa; aparelho, país e inscritos seguem somando o total do dia a dia |
| Só leitura | total 826 / 3.185; "7 blocos" | lista `BLOCOS` (derivada) | sem termos: todos os blocos menos termos e sites, números iguais aos do típico; só o total: um bloco de aviso |

Conferência contra as capturas (1440 escuro e 390 claro, 33 casos, abertas: não medido canal nas duas larguras, cartão zero e erro, zero desde a publicação, magro 7 dias a 390): batem. Medidas: 0 px de rolagem horizontal, 0 fontes abaixo de 12 px, 0 alvos reais abaixo de 44 px a 390 (o único item listado pelo script é o `H1` com `tabindex=-1`, que não é alvo), 0 `color-mix()`, só o erro de fonte externa bloqueada de propósito.

Pendência de dado: `likes` e `com` do cabeçalho do vídeo, "o normal do canal" (desde a r6 derivado: views ÷ `D.MEDIANA_OUTROS`), % assistido (desde a r6 por perfil) e os inscritos e vídeos do canal são valores de exemplo que não fecham com outro número da tela; não há outro número ao qual possam contradizer.

## 9. Resposta à revisão r4 (13/10/2026, REVISAO-UX-r4.md)

| Item | Resposta |
|---|---|
| B1-r4 (nome do canal: migalha x título x avatar, magro e extremo) | Resolvido. `ov-dados.js` ganhou `D.CANAL` (nome e sigla por cenário: tipico "tnFigueiredo" TF, extremo "tnFigueiredo Viagens" TV, magro "Aldeia Digital Lab" AD) e `D.canalDe(estado)`; migalha, h1 e avatar leem dele (`ov.js`, cabeçalho do canal). A migalha do vídeo lê `D.CANAL.tipico`. |
| B2-r4 (magro: "pesquisa 3" contra "as 5 views da pesquisa") | Resolvido. Quando a lista de termos (janela do relatório em lote) cobre mais dias que a origem, a frase diz a janela ("as 5 views da pesquisa dos 34 dias desta lista") e a linha "Sem comparar com o total da pesquisa: a origem foi medida em 8 dos 34 dias desta lista" aparece também na lista vazia (função `semComparar`). Em 7 dias, onde as janelas são iguais, fica "as 3 views da pesquisa". |
| B3-r4 (cartão magro: 31 cliques com 12 views) | Resolvido na fonte. No magro os cliques derivam das views da semana (`D.MAG_CLIQUE_POR_VIEW` 0,8: 12 views x 0,8 = 10 cliques) e a taxa é cliques ÷ impressões (10 ÷ 637 = 1,6%, entre 0,6% e 2,5%). Os outros estados seguem com a taxa fixa e já ficavam abaixo das views (1.980 contra 3.185; 127.680 contra 361.256). |
| C1 (vídeo: "seus vídeos foram mostrados") | Resolvido: na página do vídeo "este vídeo foi mostrado"; no canal continua "seus vídeos". |
| C2 (zero: "há 2709 dias") | Resolvido: a idade sai formatada ("há 2.709 dias"); o ⓘ da origem diz que a contagem de dias vai até 11/10 (último dia entregue) e a idade do vídeo conta até hoje, o que explica 2.709 contra 2.708. |
| C3 (zero: "veio de lugar nenhum") | Resolvido: "O YouTube mandou os 7 dias e nenhuma view foi contada." |
| C4 (revisão: ⓘ diz "o total sempre fecha") | Resolvido: em revisão o item diz "Aqui a soma das origens passou do total, por isso a divisão não aparece até conferir." |
| S1 (frase repetida no não medido) | Feito: o motivo do relatório em lote virou "Quando o relatório do YouTube chegar, este bloco aparece sozinho. Não é zero."; o da origem, "Antes dessa data não guardamos a origem; não é zero." |
| S2 ("só as 944 dos dias medidos") | Feito: "as 944 views dos dias medidos". |
| S3 (cartão: impressões 41.300 e termos "não coletada") | Declarado: as quatro linhas antigas do cartão (impressões, cliques, taxa, % assistido) vêm do que já existe em produção, não do relatório em lote; por isso aparecem mesmo quando as impressões por origem, o relatório novo, ainda não chegaram. Não há erro de coerência: são duas fontes. Pergunta ao dono na seção 3 se quiser que o cartão diga isso. |
| S4 (lupa e seta mudam de cor) | Declarado no ⓘ de termos e sites: "a lupa e a seta são laranja aqui porque esta lista é só do seu canal; no bloco de origem a cor diz de onde vieram as views". |
| S5 (barra do mockup ignora escolha em silêncio) | Feito: a linha Tela só lista o que vale para o estado (extremo, magro e carregando: canal e cartão; zero e sem dado: vídeo e cartão), e a nota da barra diz isso. |
| S6 (erro: última consulta boa sem mostrar nada) | Pergunta ao dono, não é erro de desenho: mostrar a última leitura boa (12/10, 06:10) em vez do bloco vazio? Padrão adotado: bloco vazio com a data. |
| S7 (só o total: 3.185 duas vezes) | Feito: no canal "só o total" o cartão "Views no período" sai e o total fica no cabeçalho (o aviso diz "o total acima"); no vídeo o cartão continua, porque o cabeçalho do vídeo mostra as views da vida inteira, não as do período. |
| S8 (aria "não medido" em revisão) | Feito: `aria-label` "origem em revisão" no bloco; o chip continua hachurado por decisão já anotada. |
| S9 (cinza das fatias) | Declarado e aceito: no preto e branco quem separa as fatias é o símbolo, a ordem fixa e o filete; sem mudança. |

Achados novos da varredura desta rodada (feita por código e lendo o texto de todos os estados e larguras):

| # | Achado | Conserto |
|---|---|---|
| N1 | Zero, vídeo, "desde a publicação": termos e sites diziam "Nenhuma view veio da pesquisa neste período", mas o período é desde 2019 (41.200 views) e a lista cobre 34 dias | "nos 34 dias desta lista" (e "nos 7 dias desta lista" em 7 dias), derivado de `ts.cob.ok` |
| N2 | Países: "vieram de Brasil" e "de Estados Unidos" | função `dePais`: "do Brasil", "dos Estados Unidos", "dos Países Baixos", "da República Democrática do Congo" |
| N3 | Não medido: ⓘ de impressões dizia "vale desde o primeiro relatório do YouTube, que ainda não chegou, antes do começo da coleta" | "vai valer desde o primeiro relatório do YouTube, que ainda não chegou"; o de termos e sites, "a partir do primeiro que chegar" |

`verificar-coerencia.mjs` ganhou as conferências que o revisor pediu e outras da mesma classe, todas por código: (a) nome do canal igual na migalha, no título e na sigla do avatar; (b) "N views da pesquisa" (ou de sites de fora) numa lista vazia tem a janela da origem ou a janela dita mais a linha "Sem comparar"; (c) cliques do cartão menores ou iguais às views da mesma semana (cruzando cartão e página do canal, estado a estado); (d) nenhuma frase "seus vídeos" na página do vídeo; mais: "N de M" com N maior que M, número de 4 dígitos sem separador de milhar, janela de datas invertida ou que passa de 11/10, idade do vídeo que não bate com a data, ⓘ de revisão dizendo "o total sempre fecha", e não medido sem a data 14/10. Última rodada: 73 casos, 0 falhas.

## 10. Tabela de coerência por estado (r5): o que cada número mostrado é e com o que fecha

Fonte única dos números: `ov-dados.js` (perfis `canalTip`, `videoTip`, `ext`; magro por `MAG_DIA`, `MAG_ANTES`; identidade em `D.CANAL`). Datas: hoje 13/10, último dia entregue 11/10, coleta 04/10 (8 dias medidos), relatório em lote 08/09 (34 dias). Os números abaixo são os lidos do DOM nas capturas desta rodada.

| Estado | Números e textos mostrados | De onde derivam | Fecham com |
|---|---|---|---|
| Típico, canal 7 / 28 / 90 / 2015 | 3.185 / 11.640 / 36.440 / 1.842.600 views; "8 de N dias"; origens e omitido; impressões 41.300 (7 dias) | R 455 x 8 + Rant 400 x (N-8); 5.900 impressões por dia | cabeçalho = rodapé; total da barra = 3.640 (8 x 455) em 28, 90 e 2015; impressões = dias do relatório em lote x 5.900; base dos termos 'sem comparar' diz 8 dos N dias |
| Típico, vídeo 7 dias e desde a publicação | 826 e 3.870 views; "há 23 dias"; "22 dias" desde 20/09 | R 118 x 7; 944 + 14 x 209 | 3.870 = célula views do cabeçalho (vida inteira); 826 = barra; "este vídeo foi mostrado 11.550 vezes" = 1.650 x 7; engajamento (212+31)/3.870 = 6,3% |
| Extremo, canal | 18.742.300 views; 8 de 4.205 dias; nome "tnFigueiredo Viagens", sigla TV | perfil `ext`; 08/04/2015 a 11/10/2026 | migalha = título = avatar; total da barra 412.864 = 8 x 51.608; nenhuma conta passa de 11/10 |
| Magro, canal 7 / 28 / 90 / 2015 | 12 / 19 / 36 / 36 views; origem 14 views em 8 dias (pesquisa 3, sugeridos 2, omitido 9); termos vazios: "as 3 views da pesquisa" em 7 dias, "as 4 ... dos 28 dias" e "as 5 ... dos 34 dias desta lista" nos outros; nome "Aldeia Digital Lab", sigla AD | `MAG_DIA` = 2,1,3,2,1,2,2,1 (soma 14); `MAG_ANTES` 22 em 82 dias | 12 = soma dos 7 últimos; 14 + 5 = 19 (28 dias); 14 + 22 = 36 (90 e 2015); pesquisa 3 (origem) contra 4 e 5 (lista) explicados pela linha "Sem comparar... 8 dos 34 dias"; "5 views das 14, 9 omitidas" = 5 + 9 = 14; migalha = título = avatar |
| Zero medido, vídeo 7 / desde a publicação | 41.200 views (vida); "há 2.709 dias" desde 14/05/2019; "7 de 7" e "8 de 2.708"; zero em cada bloco; termos "nos 7 / 34 dias desta lista" | views da vida = cenário "desde a publicação"; 2.709 = 14/05/2019 até 13/10; 2.708 = até 11/10, inclusive | idade e 2.708 explicados no ⓘ; "Zero medido" só onde o YouTube mandou o dia; nenhuma frase de view positiva no período |
| Não medido, vídeo e canal | "0 de 7 / 28 / 90 / 4.205 · a coleta começa em 14/10"; origens, impressões, termos, aparelho, país, inscritos todos "não medido" com 14/10 | `COLETA_FUT` 14/10 | nenhum "7 de 7"; nenhuma frase de porcentagem; ⓘ diz "vai valer desde o primeiro relatório" |
| Sem dado ainda, vídeo | publicado 12/10 (há 1 dia); 187 views (r6); "primeira leitura em 15/10" | `VAZIO_PUB` + 3 dias | 5,3% = (9+1)/187; 15/10 = 12/10 + 3; nenhum número de origem |
| Erro | "—" e "de N · não conseguimos ler agora"; cabeçalho com o total certo | total do dia a dia vem de outra fonte | texto cita as sete faltas; última boa 12/10 06:10 (pergunta S6) |
| Carregando | "—" e "de 90 · carregando"; 36.440 no cabeçalho | mesma fonte do típico 90 dias | esqueletos lisos; nenhum número de origem |
| Origem em revisão | célula "7 de 7 · origem em revisão"; tabela 826 contra 860 | soma das origens passou em 34 | ⓘ diz que a soma passou do total; termos "Sem comparar... a origem está em revisão"; aparelho, país e inscritos somam 826 |
| Só leitura (sem termos / só o total) | 826 e 3.185; "7 blocos" | lista `BLOCOS` | sem termos: iguais ao típico; só o total no canal: o total só no cabeçalho (S7), "o total acima" |
| Cartão da comparação, os 10 estados | 41.300 impressões / 1.980 cliques / 4,8% (típico e afins); 2.660.000 / 127.680 / 4,80% (extremo); 637 / 10 / 1,6% entre 0,6% e 2,5% (magro); zero e sem dado conforme a página | impressões = dias x impressões por dia; cliques = 1.980 por taxa fixa, ou views x 0,8 no magro | impressões iguais às da página do canal em 7 dias; líder, aparelho, país, inscritos e busca líder iguais às da página; cliques menores que as views da mesma semana (1.980 < 3.185; 127.680 < 361.256; 10 < 12) |

Conferência contra as capturas: refiz as 66 capturas (33 casos x 1440 escuro e 390 claro) e abri as dos estados que mudaram (magro canal 90 dias a 1440 escuro e 390 claro, cartão magro a 1440, zero do vídeo a 1440): nome AD nas três posições, cliques 10 de 12 views, "as 5 views da pesquisa dos 34 dias desta lista" com a linha "Sem comparar" logo abaixo, "há 2.709 dias" e "nos 7 dias desta lista". Medidas: 0 px de rolagem horizontal, 0 fontes abaixo de 12 px, 0 alvos reais abaixo de 44 px a 390 (o script lista só o `H1` com `tabindex=-1`, que não é alvo), 0 `color-mix()` fora de comentário; o único erro de console é a fonte externa bloqueada de propósito.

## 10b. Resposta à revisão r5 (13/10/2026, REVISAO-UX-r5.md)

| Item | Resposta |
|---|---|
| B1-r5 (zero: 0,2x com 41.200 views contra 1,4x do típico) | Resolvido na fonte: `D.MEDIANA_OUTROS = 2764` e `D.normalDoCanal(vida)` em `ov-dados.js`; os dois vídeos leem dela (típico 3.870 ÷ 2.764 = 1,4x; zero 41.200 ÷ 2.764 = 14,9x). Optei por 14,9x (um vídeo de 2019 que foi um sucesso e hoje está parado) em vez de baixar as views do zero. O script confere razão = views ÷ mediana única em todos os casos de vídeo. |
| C1-r5 (vazio com o mesmo título do típico) | Resolvido: título "Hanói à noite: o que ver depois das 22h"; views do vazio passam a `D.VAZIO_VIEWS = 187` (não repete o 212 das curtidas do típico), engajamento (9+1)/187 = 5,3%; comentários do zero 212 -> 340 (5,4%) pelo mesmo motivo. O script confere: um título, uma data de publicação em todos os estados. |
| S1-r5 (ⓘ) | Feito: "a idade do vídeo conta até hoje" só na página do vídeo; no não medido o ⓘ diz "Quando a coleta começar, a soma das origens mais o omitido será igual ao total" em vez de "o total sempre fecha". |
| S2-r5 (24/08 no ⓘ) | Feito: a linha só aparece quando o período cruza 24/08/2026 (mesma regra do losango da régua). |
| S3-r5 (% assistido fixo) | Feito: `D.ASSIST_PERFIL` (típico 51%, magro 38%, extremo 58%); o script falha se os três forem iguais. |
| S4-r5 (aria-label da revisão no cartão) | Feito: a linha de origem do cartão em revisão tem `aria-label="origem em revisão"`. |
| S5-r5 (`pais=mes`) | Feito: só existe no canal típico (o vídeo de 20/09 não tem 3 meses fechados); total = 92 dias x 400 views/dia = 36.800 (derivado, antes 34.100 e 2.299 digitados); as linhas somam 36.800. Continua fora da fila de aprovação. |
| Pedido de método da r5 | `verificar-coerencia.mjs` ganhou: razão = views ÷ mediana única; mesmo título = mesma data; ⓘ do canal sem "idade do vídeo"; 24/08 só em período que cruza; não medido sem "total sempre fecha"; % assistido diferente por perfil. 73 casos, 0 falhas. |

Varredura adicional (r6), além dos itens da revisão: coerência de `pais=mes` (corrigida, acima); comentários do zero iguais ao número de curtidas do típico (trocado); vídeo em "Sem dado" com 187 views e engajamento recalculado; conferido de novo, por código, que cabeçalho x barra x rodapé x cartões, cartão x canal e janelas de datas seguem fechando (script). Nada mais achado.

## 11. Tabela de coerência por estado (r6): número mostrado, de onde deriva, com o que fecha

Datas: hoje 13/10/2026; último dia entregue 11/10; coleta de origem desde 04/10 (8 dias até 11/10); lote desde 08/09 (34 dias). Fontes únicas em `ov-dados.js`: perfis (`canalTip`, `videoTip`, `ext`), `MAG_DIA`, `MEDIANA_OUTROS`, `VAZIO_VIEWS`, `VAZIO_PUB`, `COLETA_FUT`, `ASSIST_PERFIL`, `TAXA`. Conferido contra as capturas de `shots/` (abertas: zero do vídeo 1440 escuro e vazio do vídeo 390 claro; o resto por texto e medida do script).

| Estado | Número na tela | Deriva de | Fecha com |
|---|---|---|---|
| Típico, canal 7/28/90/desde 2015 | 3.185; 11.640; 36.440; 1.842.600 | 455 x 7; 8 x 455 + 20 x 400; 3.640 + 82 x 400; informado | cabeçalho = total da barra (cobertura total) ou rodapé "Views no período todo"; origens + omitido = total medido; aparelho, país, inscritos somam o total medido; impressões 41.300 = 7 x 5.900 |
| Típico, vídeo | 826 (7 dias); 944 medidos; 3.870 na vida; 1,4x; 6,3%; "há 23 dias" | 118 x 7; 8 x 118; 944 + 14 x 209; 3.870 ÷ 2.764; (212+31)/3.870; 20/09 a 13/10 | cabeçalho "views" = "Views no período todo" desde a publicação; 22 dias de 20/09 a 11/10; impressões 22 x 1.650 = 36.300 |
| Extremo | 361.256; 412.864 medidos; 18.742.300 | 51.608 x 7 e x 8; informado | origens + omitido 12.387 = 412.864; nome "tnFigueiredo Viagens" na migalha, título e sigla TV; cartão: 127.680 cliques < 361.256 views |
| Magro | 12 / 19 / 36 / 36; 14 medidos; "5 de 14" na origem | `MAG_DIA` 2,1,3,2,1,2,2,1 + 22 em 82 dias | termos "as 3 views da pesquisa" (7 dias) e "as 5 ... dos 34 dias" com a linha "Sem comparar"; 637 impressões = 91 x 7; 10 cliques <= 12 views; 10/637 = 1,6% |
| Zero medido (vídeo) | 41.200 views; 14,9x; 5,4%; 0 em cada bloco; "há 2.709 dias" | `vida` do cenário; 41.200 ÷ 2.764; (1.900+340)/41.200; 14/05/2019 a 13/10 | caixa "0" por bloco; 0 impressões; "7 dias medidos" = régua; 2.708 dias até 11/10 explicado no ⓘ |
| Não medido | "0 de 7"; "a coleta começa em 14/10"; 3.185 (views do dia a dia) | `COLETA_FUT` | todos os blocos "não medido" com a mesma data; ⓘ com a mesma data e sem "total sempre fecha"; nenhuma porcentagem |
| Sem dado ainda | 187 views; 5,3%; publicado 12/10 (há 1 dia); "primeira leitura em 15/10" | `VAZIO_VIEWS`; (9+1)/187; `VAZIO_PUB` + 3 | razão "novo demais"; todos os blocos "Ainda não existe"; título diferente do típico |
| Erro | "—" na célula; 3.185 ou 3.870 no cabeçalho | sem leitura | sete faltas citadas = sete blocos; total igual ao do típico |
| Carregando | "—"; 36.440 | período 90 | esqueletos; cartão "Carregando…" |
| Revisão | 826 contra 860 (34 a mais); "origem em revisão" | soma > total | ⓘ, bloco, célula e `aria-label` do cartão dizem revisão; termos sem comparar |
| Só leitura | 7 blocos; total 826 / 3.185 | lista `BLOCOS` | sem termos e sites: números do típico; só o total: aviso |
| Cartão x canal (7 dias) | impressões, líder, aparelho, país, inscritos, busca líder, cliques | mesmo perfil | iguais nos 10 estados; % assistido 51 / 38 / 58 por perfil |
| `?pais=mes` (canal típico) | 36.800 | 92 x 400 | 25.766 + 4.414 + 1.467 + 739 + 370 + 2.207 + 370 + omitido 1.467 = 36.800 |
