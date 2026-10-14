# Roteiro de teste e melhorias futuras dos mockups do Observatório

Documento vivo. Criado em 13/10/2026, a pedido do dono ao aprovar o mockup 14: "todas as recomendações de o que testar e tudo mais que foi capturado, fosse anotado para propor melhorias futuras conforme feedback venha", para os mockups já vistos, os que faltam e os futuros.

## Para que serve

Memória do que testar em cada tela e do que ficou em aberto. Quando a tela virar código e o dono usar de verdade, o que ele achar volta para cá, na seção "Retorno do dono e do uso real" do mockup certo, com data, e vira proposta de melhoria. Nada aqui é decisão nova: tudo vem das pastas de cada mockup (`NOTAS.md`, `PLANO.md`, `REVISAO-UX-rN.md`) e de `APROVACOES-DO-DONO.md`. O que não estava nas pastas está escrito como "não registrado".

## Como usar

1. Sirva os mockups (próxima seção) e abra o endereço do mockup.
2. Faça o roteiro de teste da seção dele, na ordem. Cada item diz o que olhar e a pergunta a responder.
3. Anote o que achou em "Retorno do dono e do uso real", com a data (dd/mm/aaaa) e o estado em que viu (nome do `?caso=` ou do botão da barra "Estados do mockup").
4. Quando a tela já for código, repita o roteiro com dado real e anote a diferença. Melhoria proposta nasce de uma anotação: escreva a anotação, depois a proposta, e marque se foi aplicada.
5. Mockup novo ganha uma seção com os mesmos seis blocos e uma linha no quadro-resumo.

## Como servir os mockups localmente

```
cd docs/superpowers/mockups && python3 -m http.server 47701 --bind 127.0.0.1
```

Endereço: `http://127.0.0.1:47701/<lote>/<pasta>/index.html`, por exemplo `http://127.0.0.1:47701/2026-10-13-a5-lote-2/14-estourou-e-parou/index.html?caso=tipico&tema=claro`.

O servidor tem de ser na raiz dos mockups: o 17c lê a base visual (`a4.css`, `a4-comum.js`, `lote.css`, `lote.js`) de `../../2026-10-13-a5-lote-1/`. Os cinco mockups do lote 1 são arquivos `.html` soltos na pasta do lote 1 (por exemplo `.../2026-10-13-a5-lote-1/a-ainda-cedo.html?caso=4d-zeros`). Todo mockup tem uma barra recolhida no topo, "Estados do mockup", fora da tela simulada, com um botão por estado. `?tema=claro` liga o tema claro.

## Roteiro comum (vale para todo mockup; cada seção repete o que é específico)

- **Celular (390 px):** abra com a janela estreita (ou o modo dispositivo do navegador a 390 px). Pergunte: a resposta de 3 segundos ainda aparece sem rolar muito? Algum botão ficou difícil de tocar? Alguma coisa cortou ou ficou sobreposta?
- **Tema claro e escuro:** `?tema=claro` e o padrão escuro. Pergunte: a hachura rosa de "não medido", a caixa vazada de "zero medido" e o pontilhado de "ainda não existe" continuam distinguíveis nos dois temas?
- **Opera:** o dono usa Opera, que já renderizou `color-mix()` transparente. Nenhum mockup usa `color-mix()`, mas ninguém abriu estas telas no Opera (todas as revisões foram em Chromium). Pergunte: hachuras, pontilhados, listras, sombras e popovers do ⓘ aparecem como nas capturas?
- **Escala de cinza (opcional):** o dono já reprovou tela que só se entende pela cor. Se tiver dúvida, tire a saturação do navegador e veja se forma, símbolo e palavra bastam.

## Quadro-resumo (estado em 13/10/2026, ~14:30)

| Lote | Nº | Nome | Estado |
|---|---|---|---|
| 1 | A | Ainda cedo (impressões do vídeo novo) | Aprovado pelo dono em 13/10/2026 (decisão 62) |
| 1 | B | % assistido por período | Aprovado pelo dono em 13/10/2026 (decisão 62) |
| 1 | C | Canal de concorrente em erro | Aprovado pelo dono em 13/10/2026 (decisão 62) |
| 1 | D | Atraso da leitura por hora | Aprovado pelo dono em 13/10/2026 (decisão 62) |
| 1 | E | Saíram do YouTube | Aprovado pelo dono em 13/10/2026 (decisão 62) |
| 2 | 11b | Retenção do vídeo próprio: janela e faixa do YouTube | Aprovado pelo dono em 13/10/2026, com os sete padrões aceitos |
| 2 | 12 | De onde vêm as views | Em ajuste: o roteiro pode mudar |
| 2 | 13 | Histórico do vídeo de concorrente | Em ajuste: o roteiro pode mudar |
| 2 | 14 | Estourou e parou | Aprovado pelo dono em 13/10/2026  |
| 2 | 15 | Página do canal de concorrente | Em ajuste: o roteiro pode mudar |
| 2 | 16 | Lista de canais com direção, estado e filtros | Aprovado pelo dono em 13/10/2026 (13/10/2026) |
| 2 | 16b | Mudanças, "Outras mudanças" fora da conta Trocas | Aprovado pelo dono em 13/10/2026  |
| 2 | 17a | Comparar canais com as medidas novas | Aprovado pelo dono em 13/10/2026  |
| 2 | 17b | Outliers por views aos 7 ou 30 dias | Aprovado pelo dono em 13/10/2026  |
| 2 | 17c | Insights: quem sobe e quem desce no nicho | Aprovado pelo dono em 13/10/2026  |
| 2 | 18 | Aviso "banco chegando ao limite" | Reprovado pelo dono em 13/10/2026, em ajuste: o roteiro vai mudar para percentual |
| 2 | 20 | Comentários de destaque do vídeo de concorrente | Em ajuste: o roteiro pode mudar |
| 2 | 21 | Ritmo por hora | Segurado: o desenho está pronto, mas só vai ao dono depois da medição de 14 dias da leitura horária em produção (item 140) |
| 2 | 22 | Perguntar a uma IA | Aprovado pelo dono em 13/10/2026 ("gostei bastante"), com os nove padrões aceitos |
| 2 | 3b | Vídeo próprio: faixas "em teste A/B" e "antes do início do registro" | Em ajuste: o roteiro pode mudar |

Estados dos mockups em ajuste, segundo a última revisão de UX que existe na pasta: 13 (r6: três "corrige"), 15 (r5: um bloqueio e cinco correções), 20 (r5: um bloqueio e dois "corrige"), 3b (r6: um bloqueio e dois "corrige"). No 12, a última revisão da pasta (r6) diz "pronto para o dono, 0 bloqueios"; o controlador informa que o 12 está em ajuste, então há ajuste que não está nos arquivos que li. Conferir antes de testar.

Pendências de arquivo, não de desenho:
- 17c: lê `a4.css`, `a4-comum.js`, `lote.css` e `lote.js` de `../../2026-10-13-a5-lote-1/`. Copiar os quatro para a pasta dele antes de congelar.
- 11b: o `PLANO.md` ficou para trás do desenho (revisão r2, melhoria 8); vale a `NOTAS.md`.
- 17b: a `NOTAS.md` ainda diz "o revisor de UX ainda não viu esta tela", mas há revisão r2 liberando.
- 20: a `NOTAS.md` ainda diz "o revisor de UX ainda não viu esta tela", mas há revisões até a r5.

---

# LOTE 2 (13/10/2026)

Fonte comum: `docs/superpowers/mockups/2026-10-13-a5-lote-2/` (`CONVENCOES.md` e `APROVACOES-DO-DONO.md` na raiz do lote). Tudo nos mockups é exemplo (nomes, números, datas); "hoje" nos mockups é 13/10/2026 salvo onde dito.

---

## 11b. Retenção do vídeo próprio: janela e faixa do YouTube

Estado: aprovado pelo dono em 13/10/2026, com os sete padrões aceitos (liberado antes pelo revisor de UX, r2). Em aberto para o implementador: quantas views separam curva "serrilhada" de "boa" (100 é só exemplo) e como o valor por ponto do YouTube vira um número por leitura. Pasta: `2026-10-13-a5-lote-2/11b-retencao-janela-e-faixa/`. Não é o "mockup 11" do spec: é um acréscimo ao bloco Retenção já aprovado (mockup 6), liberado pela decisão 61; o que é novo leva contorno tracejado verde-água e "+ novo".

### 1. O que a tela responde
"Esse vídeo segura as pessoas bem ou mal, onde elas saem, e isso vale para a estreia ou para a vida toda?" Três cartões de janela (primeiros 7 dias, primeiros 30 dias, vida toda) trazem a miniatura da curva, "metade saiu aos m:ss" e a data da leitura; o clique escolhe qual vai para o gráfico grande. Logo abaixo, uma faixa com régua de 0 a 1 compara o vídeo com "vídeos de duração parecida" (cálculo do YouTube), com a marca cravada na régua. Frase-resumo no topo.

### 2. Roteiro de teste
URL base: `.../11b-retencao-janela-e-faixa/index.html?caso=<caso>&janela=7|30|vida`.
1. `caso=tipico` (as 3 janelas, uma por vez): olhar a frase de topo e a faixa "▲ Acima de vídeos de duração parecida". Pergunta: em 3 segundos dá para saber se o vídeo segura bem ou mal? A faixa, que vem depois dos cartões, está perto o bastante da frase?
2. Trocar de janela clicando nos cartões e com as setas do teclado. Pergunta: a curva e a faixa mudam junto? Dá para comparar as três janelas sem clicar?
3. `caso=aberta&janela=30`: olhar a barra "dia 18 de 30" e "fecha em 25/10". Pergunta: fica claro que ainda não deu tempo, e não que deu zero?
4. `caso=short`: curva passa de 100% (eixo vai a 140%), nunca cruza 50%, comparação 0,97. Pergunta: a curva acima de 100% é entendida ou parece erro?
5. `caso=antigo&janela=7` e `janela=30`: vídeo de 2015 cuja janela fechou antes da coleta. Pergunta: a frase de topo ("a janela não existe") bate com o painel ("fechou em 21/03/2015, antes de começarmos a coletar")? (Melhoria 3 da revisão diz que o topo está impreciso.)
6. `caso=serrilhada` (41 views): curva balança, aviso "leia como indício", sem saídas nem trechos marcados. Pergunta: o aviso é visto antes de a curva ser interpretada?
7. `caso=vazia` (o YouTube não devolveu curva) × `caso=zero` (0 trechos revistos, comparação 0,02) × `caso=nao-coletada` (estado real de hoje, vida inteira sem linha): hachura rosa × caixa vazada com 0 × cinza. Pergunta: "não medido" e "zero medido" são distinguíveis de relance?
8. `caso=sem-faixa`: curva veio, comparação do YouTube não. Pergunta: a ausência da faixa é explicada ou parece quebra?
9. `caso=novo` (vídeo de ontem, as 3 janelas ainda não existem): pontilhado "ainda não existe". Pergunta: distingue de "não medido"?
10. `caso=erro` (leitura anterior continua na tela) × `caso=erro-sem` (primeira tentativa falhou): o texto diz o que falhou e o que ainda se vê?
11. `caso=leitura`: usuário só de leitura não vê a curva; caixas com cadeado sem rosa. Pergunta: a tela diz o que falta e por quê?
12. Abrir "Ver as N leituras" a 390 px: cada valor tem rótulo ("Metade saiu aos", "No fim", "Comparação do YouTube")?
13. Teclado: Tab entra no seletor com um só item; setas trocam; Home e End (a revisão achou que não funcionam). Pergunta: a ordem de foco faz sentido?
14. Escolha de janela salva no navegador: trocar para 7 dias, recarregar sem `?janela=`. Pergunta: aparece "Salvo neste navegador · Voltar ao padrão (vida inteira)"? (Atenção: a revisão r2 viu a linha aparecer sem ter salvo quando a URL traz `?janela=`; no mockup isso é efeito da URL.)
15. Celular 390 px: cartões "Vida toda" alinhados, rótulo da faixa dentro do cartão, nenhum botão pequeno.
16. Tema claro e escuro: a zona ativa da régua (contraste medido 3,09 a 3,48) é vista nos dois?
17. Opera: hachura rosa dos cartões "não medido" e a régua.

### 3. Decisões pedidas ao dono (NOTAS, "Dúvidas para o dono")
1. Cor da faixa do YouTube. Padrão: as mesmas cores e símbolos ▲ ▼ ＝ do lote 1, separadas pela régua de 0 a 1 e pelo selo "cálculo do YouTube". Alternativa: forma e cor próprias; só o CSS da faixa muda. Resposta: não registrada.
2. Cortes de "na média". Padrão: 0,45 a 0,55 sobre o valor com duas casas (escolha nossa, dita no ⓘ). Resposta: não registrada.
3. A comparação muda com a janela? Padrão: uma comparação por leitura. Como o valor por ponto vira um número por leitura (média? ponto final?) fica para o implementador confirmar com a API. Resposta: não registrada.
4. "Leitura de dd/mm" no lugar de "lida em dd/mm" (a regra proíbe "lido"). Alternativa: "lida em". Resposta: não registrada.
5. "Poucas views" como não medido. Padrão: curva vazia do YouTube = hachura; curva serrilhada = curva com aviso. Quantas views separam "serrilhada" de "boa"? O exemplo usa 100, não é regra. Resposta: não registrada.
6. 7 e 30 dias com resposta vazia: padrão "buscada uma vez só", sem nova tentativa. Resposta: não registrada.
7. "Como a curva mudou" compara a primeira leitura com a mais recente. Alternativa: com a anterior, ou escolher. Resposta: não registrada.
Mais uma decisão aberta da revisão: veredito antes ou depois do seletor (ver bloco 4, item 1).

### 4. Melhorias que o revisor de UX sugeriu e não bloqueiam (última: r2)
A NOTAS só responde a r1 ("falta a rodada 2"); logo, estas ficaram abertas:
1. Veredito depois do seletor: a faixa ("bem ou mal") vem uns 300 px abaixo da frase. Se o dono preferir o veredito primeiro, a faixa sobe. Decisão do dono (era a melhoria 9 da r1). Aberta.
2. "Salvo neste navegador" aparece sem ter salvo (`?caso=aberta&janela=30`). No produto, mostrar só depois do clique. Aberta (`11b.js`, linha 56).
3. "A janela não existe para este vídeo" no topo de `antigo` e `nao-coletada`: trocar por "Primeiros 7 dias: não medida, a janela fechou antes da coleta". Aberta.
4. `vazia`: a frase de topo não diz de qual janela. Prefixar com a janela. Aberta.
5. `erro-sem`: "A curva ainda não foi buscada" convive com "A primeira tentativa falhou". Trocar por "A curva ainda não chegou". Aberta.
6. Teclado: Home e End não vão ao primeiro e ao último cartão (obrigatório no produto, padrão de grupo de rádio). Aberta.
7. Primeira leitura da vida inteira com 15 dias de buraco (`tipico`, `erro`): dizer na NOTAS a periodicidade da leitura da vida inteira. Aberta.
8. `PLANO.md` desatualizado (a ordem é frase, seletor, faixa em cartão próprio). Aberta.
9. Nome acessível do grupo lê "Janela da curva Como a janela é contada" (junta o ⓘ); apontar `aria-labelledby` só para o texto. Aberta.
Aplicadas da r1 (para referência): rótulos nas leituras a 390 px, rótulo preso à régua, frase acima do seletor, alinhamento dos cartões, sem rosa no "só leitura", datas coerentes, "buscada" no lugar de "lida", contraste da zona ativa, aviso com poucas views.

### 5. O que ninguém conferiu
Leitor de tela real, Safari, Opera, ordem completa do teclado (NOTAS e r2). Dado real: nenhum (vídeos e números inventados; a coleta das janelas começou "em 15/08/2026" em todos os casos, menos `nao-coletada`). Fonte do Google bloqueada nas capturas. Riscos assumidos: o spec não define o corte de "na média" nem como o valor do YouTube vira um número por leitura.

### 6. Retorno do dono e do uso real
13/10/2026: aprovado, sete padrões aceitos. (a preencher conforme o uso)

**Para o implementador:** confirmar com a API do YouTube como a comparação por ponto vira um valor por leitura; trocar `D.COLETA` (15/08/2026, exemplo) pela data real de início da coleta das janelas; `window_kind` = `primeiros_7_dias`, `primeiros_30_dias`, `vida`; classificar a faixa pelo valor arredondado a 2 casas; Home e End no grupo de rádio.

---

## 12. De onde vêm as views

Estado: em ajuste, o roteiro pode mudar. (A última revisão na pasta, r6, diz "pronto para o dono"; o ajuste atual não está nos arquivos que li.) Pasta: `12-origem-das-views/`.

### 1. O que a tela responde
"De onde vêm as minhas views, e eu posso confiar nesse número?" Uma barra empilhada de 40 px que fecha com o total de views; a última fatia é "omitido pelo YouTube" (tracejada e vazada: nem zero, nem não medido), nunca repartida. Abaixo, lista como legenda e tabela (símbolo, nome, views, %), blocos de aparelho, país, inscritos, termos de pesquisa e sites de fora. Régua de cobertura mostra quantos dias foram medidos ("Nos 8 dias medidos (04/10 a 11/10), ...").

### 2. Roteiro de teste
URL base: `.../12-origem-das-views/index.html?estado=<estado>&tela=video|canal|cartao&periodo=7|28|90|tudo&tema=claro`.
1. `estado=tipico&tela=canal&periodo=28`: olhar a frase, a barra e a régua de cobertura (8 dias medidos de 28). Pergunta: a frase diz sobre quantos dias é o percentual? A barra fecha com o total?
2. Trocar `periodo` (7, 28, 90, tudo). Pergunta: a régua muda de forma (em "tudo", a faixa quebrada com "//" e o losango de 24/08/2026) e continua honesta (só 8 de 4.205 dias têm origem)?
3. `estado=extremo`: nome longo, números enormes, 1,2 mi. Pergunta: algo estoura a caixa?
4. `estado=magro`: canal pequeno em que "omitido pelo YouTube" domina. Pergunta: a frase diz isso? Os blocos de sites e termos dizem "Nenhum site apareceu" e nunca "zero"?
5. `estado=zero` × `estado=nao-medido` (no segundo: "0 de 28 · a coleta começa em 14/10"): no primeiro nada mudou (caixa com 0); no segundo o histórico ainda não começou (hachurado). São distinguíveis de relance?
6. Valor "—" numa lista que tem "omitido": é entendido como "o YouTube pode ter escondido" e não como zero?
7. `estado=vazio` (vídeo novo demais, "ainda não existe" nos seis blocos) × `nao-medido` (hachura): a diferença de forma faz sentido para o mesmo tipo de causa? (Melhoria M1 da revisão.)
8. `estado=erro`, `carregando`, `revisao` (origem em revisão: soma passou do total).
9. `estado=leitura` com `leitura=sem-termos` e `leitura=so-total`: a tela diz o que a pessoa não vê e quantos blocos são? Conferir se termos e sites aparecem com cadeado "só quem edita o site".
10. `tela=cartao`: o cartão "Só o seu canal mede" com as cinco linhas novas. Pergunta: cabe e é lido sem rolar?
11. URL longa de site (130 caracteres): quebra em qualquer ponto sem estourar?
12. Cores: pesquisa (azul-céu), sugeridos (violeta), início e inscrições (coral), Shorts (areia), sites de fora (azul, pontilhado), outras (cinza, listrado). Pergunta: sem a cor (cinza), símbolo e textura bastam? "Sites de fora" e "pesquisa" se confundem no claro?
13. Celular 390 px: onde começa a frase-resumo (a resposta fica abaixo da primeira dobra, cartão a ~940 px)? O popover do ⓘ cobre quase metade da tela e não tem botão de fechar.
14. Tema claro e escuro; Opera (hachura, pontilhado, listrado são `repeating-linear-gradient`; não vistos no Opera).

### 3. Decisões pedidas ao dono (NOTAS seção 3)
1. Quem é "só leitura": o direito "ver desempenho privado" dá termos e sites, ou eles continuam só para quem edita? Padrão: "sem editar" vê total e detalhes sem termos nem sites; a outra variante (só o total) é a do RLS da v2.3.
2. País por mês: confirmar que podemos apagar o mês de vez (depende da conferência 1 da E11). Padrão: saiu da fila (só atrás de `?pais=mes`).
3. Data de início da coleta (04/10 no exemplo): aceita ver régua cinza gigante mesmo com 7 de 7? Padrão: régua e "N de M dias" em todo bloco; com cobertura total a régua vira linha de texto.
4. Cor de "sites de fora" e "pesquisa" no claro (separadas por textura). Se confundir, trocar o externo por forma sem azul.
5. Impressões por origem sem "sites de fora" (não existe miniatura fora do YouTube). Padrão: não mostrar a linha.
6. Direção ("subiu em relação ao período anterior") não desenhada: quer ▲ ▼ ＝ por origem depois de 28 dias de coleta?
7. Taxa de clique por origem não desenhada (só impressões); cabe depois.
8. Cores da origem repetem cores que significam outra coisa no produto. Padrão: aceitar (o ⓘ diz que valem só dentro destes blocos). Alternativa: paleta própria.
9. A 390 px a resposta fica abaixo da primeira dobra: subir a frase-resumo para fora do cartão, ou manter?
10. Popover do ⓘ sem botão de fechar a 390 px: registro, sem mudança (padrão do produto).
Respostas do dono: nenhuma registrada em `APROVACOES-DO-DONO.md`.

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r6)
M1: "vazio" usa "não medido" (hachura) no "normal do canal" e "ainda não existe" nos seis blocos; pela regra do lote o chip certo seria "ainda não existe" (aceita nas r4/r5, aberta). M2: "Termos de pesquisa: Não coletada" com a mesma hachura de "Não medido", dois nomes para a mesma forma; sugestão "Não medido: o relatório do YouTube ainda não chegou" (aberta). M3: duração "15:47" igual no vídeo típico e no vazio; trocar (aberta). M4: canal magro "Desde 2015" mostra 36 views, igual aos 90 dias, e três canais com a mesma data de abertura (aberta). M5: combinações de URL sem tela própria caem em silêncio em outra tela (aberta, só afeta quem digita a URL). Todas ficaram abertas na r6; sugestão do revisor: decidir M1 e M2 antes do código real.

### 5. O que ninguém conferiu
Leitor de tela real, Safari, Opera (hachura, pontilhado, listrado), toque real, contraste de texto sobre hachura, contraste das fatias na r6 (herdado da r4: pior caso 4,43:1 "fora" no claro), impressão em preto e branco. Dado real: tudo é exemplo. Dívida declarada: três cartões pequenos a 1440 em ~390 px; a coluna do país é mais alta que as outras.

### 6. Retorno do dono e do uso real
Sem registro de aprovação. (a preencher conforme o uso)

**Para o implementador:** a data de início da coleta (04/10 no exemplo, "deploy menos 10 dias") é suposição: usar a real; termos, sites e impressões por origem valem desde 08/09 (outra janela); URL de site sem query string e sem fragmento, cortada na escrita; termos e sites só pelo token de edição; marca de 24/08/2026 pela função única `countRuleOf`; estado por bloco (`resolve` em `ov.js`), nunca `0` solto.

---

## 13. Histórico do vídeo de concorrente

Estado: em ajuste, o roteiro pode mudar. Última revisão (r6): três "corrige" abertos (R6-C1 ramo "até 14 dias" do `semanal`; R6-C2 frase do ⓘ do `semanal` que chama de "hachura" o que a legenda chama de pontilhado; R6-C3 n do normal das 72 horas digitado e contradizendo a lista do canal). Pasta: `13-historico-video-concorrente/`.

### 1. O que a tela responde
"Esse vídeo foi bem para a idade dele, e algo que o canal mexeu veio antes de ele subir?" Quatro blocos, cada um com uma pergunta: resumo, views por idade (vídeo contra o normal do canal), 72 horas hora a hora, e dia a dia com as mudanças. Cores de lado (azul do vídeo, areia do normal); verde só para a subida.

### 2. Roteiro de teste
URL base: `.../13-historico-video-concorrente/index.html?caso=<caso>&tema=claro`. Estados: `cheio`, `extremo`, `recente`, `magro`, `zero`, `naomedido`, `semanal`, `saiu`, `mantido`, `aovivo`, `vazio`, `carregando`, `erro`, `leitura`.
1. `caso=cheio`: frase-resumo, faixa de 5 números, pares de barras (1, 7 e 30 dias) com "N vezes o normal", curva por idade, 72 horas, faixa verde da subida e lista de mudanças. Pergunta: em 3 segundos, foi bem ou mal para a idade? A mudança que veio antes da subida salta aos olhos?
2. Aviso do topo "dia de exemplo 11/11/2026" em `cheio`, `extremo`, `semanal`, `leitura`: fica claro que é simulação de futuro?
3. `caso=recente` e `caso=magro` (reproduzem a situação real de hoje, 13/10): o que falta e quando passa a existir está escrito?
4. `caso=zero` × `caso=naomedido`: no primeiro nada mudou (caixa com 0); no segundo a contagem se perdeu ("entrou tarde na contagem", 08/10 a 11/10, hachurado). São distinguíveis de relance?
5. Curva por idade: eixo por categoria (1, 2, 3, 5, 7, 14, 21, 30, 60, 90 dias); 60 e 90 dias como círculo pontilhado ("ainda não existe"); ponto do normal com n menor que 3 vira "não medido" (hachura) e o ponto do vídeo continua. Pergunta: o eixo irregular engana?
6. Régua de 72 horas: marcas de 1/4, 1/2, 3/4 das views; marca que não existe vira ponto hachurado rosa "não medido" na ponta de 0 h com o motivo na frase. Pergunta: a hora de publicação e o trecho antes da primeira contagem (hachura rosa) são entendidos?
7. `caso=semanal`: contagem por semana ("inconclusivo: contagem por semana"). Abrir o ⓘ. Pergunta: o bloco das 72 horas e o ⓘ dizem a mesma regra? (É o R6-C1/C2 em ajuste.)
8. `caso=saiu`: pastilha "saiu do YouTube" e o atalho "Responder em Saíram do YouTube". Pergunta: um só lugar para responder basta?
9. `caso=mantido`, `caso=aovivo`, `caso=vazio`, `caso=carregando` (tem o pager "vídeo 1 de 12"? a revisão achou que não), `caso=erro`, `caso=leitura`.
10. Dia a dia com mudanças: mais de 6 mudanças viram linhas curtas; marcas a menos de 26 px se agrupam. Pergunta: a janela "entre 06:00 e 12:00" / "em algum momento entre dd/mm e dd/mm" é clara?
11. "Ver como tabela" e leitura por teclado (setas, Início/Fim/Esc): a alternativa em texto do gráfico funciona?
12. Celular 390 px: o resumo começa em ~y 880, abaixo da primeira tela (vem da casca aprovada). Rótulo "1,02 milhão" da curva por idade em `extremo` é cruzado pela linha (S5).
13. Tema claro e escuro; Opera (hachura SVG e popover do ⓘ não vistos lá).

### 3. Decisões pedidas ao dono (NOTAS seção 3)
1. A palavra "série". Padrão: até a r4 a frase exata do spec; desde a r5 "inconclusivo: contagem por semana" (a regra de frases sem jargão vence). O dono pode voltar a "série semanal".
2. Três raias (Título, Miniatura, Outras, com descrição, tags, categoria, duração e capítulos juntas). Alternativa: quatro, com a descrição separada.
3. Vídeo acima ou abaixo do normal usa as cores de lado (azul × areia), não verde/âmbar. Confirmar.
4. Normal do canal com n menor que 3 vira "não medido" mesmo com o vídeo medido (hoje vale para quase toda idade acima de 5 dias).
5. Estados de futuro com o dia de exemplo 11/11/2026 e aviso no topo.
6. Linha de corte de 24/08 só quando o eixo cobre a data (alternativa: sempre como nota do ⓘ).
7. Mudanças no mesmo dia: marcador no dia final da janela.
8. "Saiu do YouTube" sem botão Manter/Apagar aqui, só o atalho para a fila.
9. Dia da publicação sem barra quando o vídeo sai depois do meio-dia.
10. A leitura por hora começa em 04/10 neste exemplo (data de exemplo).
Respostas do dono: não registradas.

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r6)
S1: em `extremo`, a barra do dia da subida (17/10) cai fora da faixa verde (pela regra está certo; explicar). S2: em `vazio`, "contagem" com dois sentidos; trocar "do dia" por "por dia". S3: datas 03/10 e 04/10 digitadas em mais de 15 trechos de `m13.js`; usar a constante. S4: `carregando` sem o pager que o `erro` tem (salto de ~30 px). S5: rótulo "1,02 milhão" cruzado pela linha a 390 claro. S6: mantidas de rodadas anteriores: eixo das 72 horas até 50 min à esquerda da hora real; mesmo n do normal em canais diferentes; "servidor" no `erro`; resumo abaixo da primeira tela a 390. Estado: todas abertas (r6 é a última; a NOTAS ainda responde até a r5).

### 5. O que ninguém conferiu
Leitor de tela real, Safari e Opera (hachura SVG, popover do ⓘ), movimento reduzido (só leitura do CSS), ordem completa do Tab (só o ⓘ do `semanal` na r6), capturas a 390 escuro e as de `magro`, `mantido`, `aovivo`, `leitura` a 390 abertas só por medição, escala de cinza em duas telas apenas. Dado real: tudo é exemplo (tabela "dado real × exemplo" na NOTAS seção 5).

### 6. Retorno do dono e do uso real
Sem registro de aprovação. (a preencher conforme o uso)

**Para o implementador:** cabeçalho e gráfico "Views por dia e cada troca" já existem em produção (`_historico/`: `historico-screen.tsx`, `views-chart.tsx`, `lanes.tsx`); início da leitura por hora é a data do deploy da E2 (04/10 é exemplo); constantes: contagem por dia desde 03/10/2026 (real), corte 24/08/2026, mínimo de amostra 3, subida 2x e 1.000 views, janela 7 + 7 dias; o n do normal das 72 horas deve sair da lista do canal, não digitado; o mockup não resolve a diferença entre `magro` e o Histórico real de um mesmo vídeo (é discordância de exemplo, não regra).

---

## 14. Estourou e parou

Estado: aprovado pelo dono em 13/10/2026 , com os sete padrões aceitos. Pasta: `14-estourou-e-parou/`. Foi ao aprovar este que o dono pediu este documento.

### 1. O que a tela responde
"Este vídeo teve muitas views cedo, quase nada depois e pouca reação, e o que isso não prova?" Três "casas" (cheia = bate, vazada com ✕ = não bate, hachurada = não medido, pontilhada = ainda não existe) contam sinais, sem nota nem percentual. Três cartões com a mesma régua (limite, normal do canal, este vídeo). O texto obrigatório "Indício, não medição." (O que vimos / Hipótese nossa / O que ninguém de fora vê) aparece só quando o resultado é `pico_sem_cauda`. A leitura vive no Histórico do vídeo e como coluna "Leitura" no Outliers.

### 2. Roteiro de teste
URL base: `.../14-estourou-e-parou/index.html?tela=historico|outliers&caso=<caso>&tema=claro`. O mundo do exemplo é 20/04/2027 (a leitura só existe a partir de 01/01/2027); `caso=sem-dado` mostra o dia de verdade (13/10/2026).
Histórico do vídeo (`tela=historico`):
1. `caso=tipico`: olhar nome, pastilha "indício", as três casas e o texto obrigatório. Pergunta: em 3 segundos dá para saber quantos sinais batem? O texto não parece veredito?
2. `caso=extremo`, `caso=borda` (2,0x exato, metade exata, 2% exato: "igual ao limite vale"), `caso=zero` (caixa vazada com 0).
3. `caso=nao` (não é o caso): a frase diz qual sinal não bateu e por quanto, sem o texto obrigatório e sem selo. `caso=nao-rende` (ainda rende acima de 2%).
4. Não medido por motivo, cada um com "Passa a existir": `nm-semv30`, `nm-v30baixo` (menos de 1.000 views), `nm-canal` (menos de 5 vídeos), `nm-semreacao` (casas ✓ ✓ ▨, nunca ✓ ✓ ✕), `nm-aovivo`, `nm-cedo` (menos de 90 dias). Pergunta: "não medido" (hachura) se distingue de "não é o caso" (contorno ✕) sem ler?
5. `caso=sem-dado` (ainda não existe, pontilhado, linha do tempo hoje/janeiro/abril), `caso=erro` ("Isto não quer dizer que o vídeo não estourou"), `caso=carregando`.
Outliers (`tela=outliers`, `filtro=todos|com|nao|nm`):
6. `caso=cheio`: frase-resumo ("2 dos 9 outliers têm a leitura..."), barra de cobertura, filtros que servem de legenda, coluna Leitura em todas as linhas. Pergunta: a coluna em todas as linhas ajuda ou pesa?
7. Texto obrigatório no meio da lista (filtro Todos): aparece uma vez, logo abaixo da última linha com a leitura. Pergunta: atrapalha a lista? Ficaria melhor abaixo da lista inteira?
8. `caso=magro` nos quatro filtros: quase tudo hachurado; "Nenhum dos 9 outliers deu 'não é o caso'". `caso=zero` (abre em "Com a leitura", vazio): "Zero aqui é um resultado, não falta de dado". `caso=sem-dado`, `erro`, `carregando`.
9. `?nome=a|b|ambos`: "Estourou e parou" × "Muitas views, pouco sinal de que agradou". Pergunta: qual nome? (O dono aprovou o A.)
10. Sem a cor: casas cheia/vazada/hachurada/pontilhada se separam em cinza?
11. Celular 390 px: casas e réguas legíveis, filtros tocáveis.
12. Tema claro e escuro; Opera.

### 3. Decisões pedidas ao dono (NOTAS seção 3)
Resposta do dono ao aprovar: os sete padrões aceitos.
1. Nome. Padrão adotado e aceito: "Estourou e parou". Alternativa: "Muitas views, pouco sinal de que agradou".
2. Texto obrigatório só no resultado `pico_sem_cauda`. Aceito. Alternativa: sempre, com versão de uma frase para os outros estados.
3. Coluna Leitura em todas as linhas do Outliers. Aceito. Alternativa: só pastilha nas que têm a leitura.
4. "Menos de 90 dias" como motivo próprio de não medido (não está na lista fechada de 6.1.5). Aceito; confirmar para a lista.
5. "E ainda rende pouco" como rótulo da segunda condição. Aceito.
6. Só leitura: sem estado próprio (números públicos). Aceito.
7. Marca "exemplo" por cartão, não por número. Aceito.

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r3)
1. `carregando` reaproveita as casas pontilhadas de "ainda não existe": usar casas com pulso (parado com movimento reduzido). Aberta.
2. `magro` é um mundo à parte (um vídeo é não medido no `magro` e ✓✓✓ no Histórico `borda`); o implementador não deve copiar a discordância. Aberta.
3. Texto obrigatório no meio da lista no filtro Todos: alternativa é abaixo da lista inteira ("Vale para cada vídeo marcado com Estourou e parou"). Decisão registrada como padrão aceito; aberta como possível melhoria.
4. Ordem das linhas do Outliers muda uma tela existente (as com a leitura vêm primeiro). Aceito implicitamente; entra na implementação.
5. Linha de base da legenda do cartão 2 uns 5 px abaixo dos vizinhos a 1440: o implementador alinha pela base. Aberta.
6. "Zero aqui é um resultado" é abstrato; sugestão "Zero aqui é uma medida: houve cálculo, e nenhum vídeo ficou de fora." Aberta.

### 5. O que ninguém conferiu
Leitor de tela, Safari, Firefox, Opera, toque real, movimento reduzido; claro a 1440 e escuro a 390 só medidos; contraste medido na r3 (menor 4,72:1 escuro, 6,07:1 claro). A NOTAS (seção 5) diz que antes do ajuste não se mediu contraste. Dado real: tudo exemplo; o Outliers real hoje não tem a leitura (só existe a partir de 01/01/2027). Risco 11 do spec: a tela tem de parecer indício, não veredito.

### 6. Retorno do dono e do uso real
13/10/2026: aprovado  com os sete padrões aceitos; pediu este documento. Depois: (a preencher conforme o uso)

**Para o implementador:** a conta em `avaliar` (`m14-dados.js`): V30 maior ou igual a 2x a mediana do canal; cauda e "ainda rende" (28 dias / V30, até 2%); reação (curtidas + comentários aos 30 dias / V30) até metade da mediana; "igual ao limite vale" com tolerância de ponto flutuante; ordem dos motivos de não medido definida no código; testes de borda (item 55) e teste do item 56 (frases fixas aparecem; palavra proibida não aparece no HTML renderizado); a leitura só existe a partir de 01/01/2027 (datas do exemplo são de 2027, nunca hardcodar ano futuro em teste); múltiplo "N vezes o normal do canal" do Outliers atual não muda.

---

## 15. Página do canal de concorrente

Estado: em ajuste, o roteiro pode mudar. Última revisão (r5): 1 bloqueio (B1: base de 30 dias de "Criador responde" não combina com exemplos nem com o n) e 5 correções (C1 duas datas da mesma regra, 19/10 e 13/12; C2 pontinhos do Acerto quebram e deixam ✕ sozinho; C3 Inscritos mostra 2 algarismos onde promete 3; C4 `nichos` "Criador responde 0 de 12" sem percentual; C5 `parado` e `fora` com "Inscritos em 30 dias +1,0%" incoerente). Pasta: `15-pagina-canal-concorrente/`. Nota: é o mockup 15 da tabela 6.5b; a tela D do lote 1 é outra coisa.

### 1. O que a tela responde
"Este canal está subindo, parado ou caindo, e o último vídeo dele foi acima do normal?" Símbolo e frase no topo (a direção do canal inteiro e como está o último vídeo), seis células (cinco novas, contorno "+ novo"), Direção em três linhas com régua de −50% a +50% e faixa "sem mudança" de ±10%, Lançamentos (curvas de 30 dias alinhadas pela idade sobre a linha do normal), Primeiras 72 horas, Linha do tempo (barras de views por dia, três raias de publicações, mudanças e trocas), Ritmo (13 semanas) e "O que o criador respondeu".

### 2. Roteiro de teste
URL base: `.../15-pagina-canal-concorrente/index.html?caso=<caso>&tema=claro`.
1. `caso=magro` (o real de hoje): frase do topo, aviso da janela que cruza 24/08, M3(b) ▼, M3(c) e queda "não medido" com data, Lançamentos sem linha do normal (2 vídeos medidos, precisa de 3), 72 horas "não medido" (leitura por hora desde 11/10), comentários "fecha em 10/11". Pergunta: a frase responde "subindo, parado ou caindo" e "último vídeo acima do normal"? Cada "não medido" diz o motivo e a data?
2. `caso=cheio` (simulação 12/05/2027): ▲ canal, ▼ acumulada, ▲ justa, normal com n por ponto, "5 de 13 (38%)". `caso=extremo`: nome longo, 9,8 mi inscritos, queda sustentada (▼ ▼ ▼).
3. `caso=parado`: âmbar com ícone de pausa (64 dias, limite 28). Pergunta: o "＝" cinza ("sem mudança") e o estado "Parado" âmbar se distinguem? (Dúvida 2; a resposta transversal do dono, ver seção "Perguntas transversais", é: "＝" cinza com a palavra "estável"; âmbar para "parado" e "em queda".)
4. `caso=zero`: "0 de 8" em caixa vazada, dias sem view; "Criador responde" não medido (coleta de comentários desde 11/10). `caso=nm`: tudo não medido com motivo (menos de 56 dias, 3 longos, 5 vídeos, 4 longos, comentários desligados). Pergunta: caixa vazada × hachura × barra de progresso ("10 de 180 dias") se distinguem?
5. `caso=erro` (faixa da tela C do lote 1; números até 04/10; "não confirmado"), `caso=vazio` ("7 de 48 vídeos já buscados", estado "Primeira busca", nunca "Ativo"), `caso=fora` (pastilha tracejada "Saiu do YouTube em 09/10", sem link).
6. `caso=shorts` (M3(b), M3(c), M4 "não medido: este canal não tem vídeos longos"), `caso=nichos` (chip "outro nicho: o seu é Viagem"; zero medido de "Criador responde" "0 de 16 (0%)"), `caso=leitura` (vê "5 de 13 (38%)", não vê texto dos comentários, sem o botão ⋯).
7. Lançamentos: clicar em outro vídeo; cor e desenho da ponta (azul ● perto do normal, violeta ■ 1,5x a 2x, coral ◆ 2x ou mais, cinza ○ tracejado abaixo de dois terços). Pergunta: o limiar de 1,5x é o que o dono usaria?
8. Linha do tempo: mouse, setas, botões e "Ver como tabela"; corte de 24/08 só quando está na janela; trecho sem registro como retângulo hachurado. Pergunta: 90 dias bastam?
9. Ritmo: casa vazada com 0 = semana sem publicação; casa hachurada "—" = semana não medida; régua "dias desde o último vídeo" contra o limite de parado.
10. Cor das barras de views: laranja herdado do lote 1, que no resto do produto marca o canal do dono. Pergunta: confunde com "seu canal"? (Dúvida 7.)
11. Celular 390 px; tema claro e escuro; Opera.

### 3. Decisões pedidas ao dono (NOTAS "Dúvidas para o dono", padrão adotado entre parênteses)
1. "Acima do normal" começa em quanto? (1,5x o normal do canal; "abaixo" em menos de dois terços.)
2. "Parado" do dono é o ＝ ou o estado M8? (mostrados os dois como no lote 1). Resposta transversal registrada: "＝" cinza com "estável"; âmbar para "parado"/"em queda".
3. M3(c) e a queda "só a partir de…": "não medido" (hachura) ou "ainda não existe" (pontilhado)? (hachura na pastilha, pontilhado no resto da barra de progresso.)
4. Lançamentos e Linha do tempo como blocos ou abas? (blocos, com atalhos no topo.)
5. A linha do tempo mostra 90 dias; quer 180? (90, para caber a 390 px.)
6. Lançamentos em views acumuladas ou em "parte dos 30 dias"? (acumuladas.)
7. Cor das barras de views de concorrente: manter o laranja herdado ou criar cor própria? (mantido.)
Respostas do dono: só a transversal sobre o ＝ (ver acima); as demais não registradas.

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r5)
S1: o modelo de dados do exemplo não fecha por dentro (a soma dos vídeos passa a do canal em alguns dias de `zero`, `erro` e `fora`), hoje não aparece na tela. S2: "sem leitura"/"ainda sem leitura" no gráfico contra "sem registro" na legenda e tabela; usar "sem registro". S3: `parado` mostra "Publica 0,4 vídeos longos por semana" ao lado de "costumava publicar um longo a cada 5 dias"; dizer "Publicou 0,4 por semana nas últimas 13 semanas" (e rotular "valor do meio" em `magro`). S4: banner "a contagem por vídeo vai de 03/10 a 13/10" contra barra "2 de 180 dias"; acrescentar "neste canal: desde 12/10". S5: três títulos de Short repetidos no `magro`. S6: soma das casas de longos difere de "17 e 23 vídeos" por um vídeo na semana "—"; acrescentar "(17 contando a semana sem leitura)". S7: sem estado de carregando (a página real é no servidor; vira esqueleto das seis células). Estado: todas abertas.

### 5. O que ninguém conferiu
Leitor de tela, Safari, Firefox, Opera; toque real; fontes do Google bloqueadas nas capturas (quebras reais podem variar, inclusive a dos pontinhos de C2); contraste do texto "não medido" sobre a hachura; escala de cinza refeita; só abertas as capturas de `magro`, `erro`, `nm`, `zero` (1440 escuro) e `erro`, `extremo`, `vazio`, `cheio` (390 claro), os demais conferidos por texto, medidas e dados; se os números de exemplo da regra de 30 dias de comentários estão no spec 04 (o revisor leu o mockup, não reabriu o spec).

### 6. Retorno do dono e do uso real
Sem registro de aprovação. (a preencher conforme o uso)

**Para o implementador:** ▲ ▼ ＝ decidem pelo percentual arredondado exibido (+10% já é ▲); "não medido" nunca vira zero (n menor que 3 por ponto, 56 dias de registro para M3(a), 5 vídeos para M4, 4 publicações para M6, 112 dias limpos para a queda); dias de registro contam desde `max(cadastro, 24/08/2026)`; hoje a leitura por hora "começou em 11/10" neste exemplo (trocar pela data real); 12/05/2027 é data de simulação; ordem de decisão M8: fora do ar, erro, primeira busca, parado, queda, ativo; mockup assume 13 = longos com 30 a 89 dias de idade na base de "Criador responde" (B1 em ajuste: confirmar a base de 30 dias no spec 04).

---

## 16. Lista de canais com direção, estado e filtros

Estado: aprovado pelo dono em 13/10/2026 (13/10/2026), com os oito padrões das dúvidas aceitos. Pasta: `16-lista-canais-direcao-estado/`. A revisão r3 listou melhorias; ver bloco 4.

### 1. O que a tela responde
Quais canais estão subindo, parados ou em queda, e o que ainda não dá para dizer (a frase do caso `completo`: "2 canais parados, 4 subindo, 5 descendo (1 em queda sustentada)"). Uma barra de contagem de quatro casas (▲ ▼ ＝ não medido), que também são botões de filtro; em cada linha a Direção (régua) e o Estado (Ativo, Parado, Em queda, Saiu do YouTube, Primeira busca), e filtros por nicho.

### 2. Roteiro de teste
URL base: `.../16-lista-canais-direcao-estado/index.html?caso=<caso>&filtro=...&dir=up|eq|dn|nm&tema=claro`.
1. `caso=tipico` (hoje, 13/10/2026, 15 canais): olhar a faixa de aviso (até 19/10 a janela cruza a mudança de contagem de 24/08) e o chip "em queda" com hachura e a data 14/12. Pergunta: em 3 segundos dá para saber quem sobe e quem cai? "Em queda ainda não pode ser medido" é entendido, ou parece quebra?
2. `caso=tipico&filtro=queda`: vazio explicado (hachura, com a data e os dias que faltam). Pergunta: o vazio explica ou assusta?
3. `caso=completo` (15/12/2026) e `caso=extremo` (nada subindo, 4 parados, 3 em queda, um parado e em queda, 1 saiu do YouTube, 1 em erro, 1 sem vídeos, 1 com inscritos ocultos, queda de -78%, 14,2 mi de inscritos, nome de 60 caracteres). Pergunta: algo estoura ou se corta?
4. `caso=zero` e `caso=zero&dir=dn`, `caso=zero&filtro=parados`: quatro chips e casas viram caixa vazada com 0. Pergunta: "0 medido" e "não medido" (hachura) se distinguem?
5. `caso=magro` (11 canais com menos de 56 dias, "medida em 4 de 15"): a casa "não medido" tem rótulo de três linhas a 390 (a barra cresce 16 px). Pergunta: a data "fecha em dd/mm" por canal é útil?
6. `caso=erro` (2 canais, linha do lote 1 de 141 px), `caso=fora` (1 canal, linha esmaecida, sem link para o YouTube; aba "Saíram do YouTube" com contador), `caso=carregando` (borda tracejada cinza, nunca hachura), `caso=leitura` (aviso sob os botões, "Sincronizar agora" e "Mais ações" desligados com o motivo), `caso=muitos` (78 canais, 20 por vez, "Mostrar mais 10", filtro por nicho Viagem/IA/Humor com contagem).
7. Direção ao lado de Crescimento (▲ ▼ em texto simples, inscritos em 30 dias): os dois, com símbolos parecidos, confundem? Título da coluna Direção diz "views".
8. Canal parado e em queda ao mesmo tempo: pastilha de parado e queda em frase curta; o filtro "Em queda" inclui esse canal (a soma dos filtros pode passar do total). Pergunta: faz sentido?
9. Seu canal na lista: direção "não medido: contagem pública por dia do seu canal ainda não é guardada". Pergunta: o texto serve?
10. Filtros por teclado: botões com `aria-pressed`; o foco volta ao botão depois de filtrar.
11. Celular 390 px: a tabela vira cartão; barra de contagem; altura das linhas (alvo 132 a 155 px com erro).
12. Tema claro e escuro; Opera.

### 3. Decisões pedidas ao dono (NOTAS seção 3)
Resposta do dono ao aprovar: oito padrões aceitos como estão (não discordou de nenhum). Pergunta transversal: "＝" cinza com a palavra "estável"; âmbar para "parado"/"em queda".
1. "Em queda" antes de 14/12: hachura com a data (adotado) ou esconder o chip.
2. "Saiu do YouTube" (nome do lote 1) no lugar de "fora do ar"; duas leituras sem o canal viram a pastilha; a ação de remover vai para "Mais ações".
3. Canal parado e em queda: o filtro "Em queda" o inclui.
4. Canal sem views para comparar: "não medido: sem views nos 56 dias para comparar" (não está na lista fechada de 6.1.5; precisa entrar?).
5. Seu canal na lista: direção "não medido" com o texto citado.
6. Direção ao lado de Crescimento: quadrado cheio e régua; Crescimento fica como está.
7. Parado × "＝": os dois desenhados (respondido, ver acima).
8. 75 canais ou mais: cota "78 de 120 canais"; paginação de 10 em 10 é dívida aceita do lote 1.

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r3)
M1: a tag "+ novo" do cabeçalho da coluna Direção encosta no topo da palavra (subir a tag 3 px); é anotação do mockup. M2: casa "não medido" do magro a 390 com rótulo de três linhas; mover a data para o ⓘ. M3: `carregando` com casas de 18 px contra 160 a 300 px das reais (salto de layout); esticar o esqueleto. Estado: abertas (a NOTAS só responde até a r2).

### 5. O que ninguém conferiu
Leitor de tela, Safari e Opera; ordem de teclado da barra de ferramentas, abas e cabeçalho (são `span` estáticos copiados do lote 1 e não entram no Tab); a semântica de tabela some no cartão a 390 (CSS `display:grid`); claro a 1440 e escuro a 390 só medidos; escala de cinza raciocinada, sem captura. Dado real: tudo exemplo. Dívida herdada, não piorada: "Sincronizar agora" em duas linhas a 1440; abas rolam por dentro a 390 px. O bloco de resumo de erro do lote 1 (escada de três idades) não foi redesenhado aqui. A tabela fecha só com a palavra da direção escondida a 1440; mexer em coluna exige refazer a conta (o `extremo` tem 0 px de folga).

### 6. Retorno do dono e do uso real
13/10/2026 (13/10/2026): aprovado, oito padrões aceitos como estão; respondeu a pergunta transversal do "＝". Depois: (a preencher conforme o uso)

**Para o implementador:** direção = views ganhas em 28 dias / 28 anteriores (`competitor_channel_snapshots.view_count`); ▲ a partir de +10%, ▼ a partir de -10%, sobre os números exibidos; parado = dias desde a última publicação maior que max(28, 4 x intervalo habitual); em queda = três janelas de 28 dias seguidas com M3(a) menor ou igual a -10%, só a partir de 14/12/2026; saiu do YouTube = `channels.list` sem o canal em duas leituras (`missing_since`); em produção, usar semântica de lista ou `role` nos cartões; classe `.nm` só na pastilha. Observação para conferir: o exemplo `magro` supõe 11 de 15 canais com menos de 56 dias, mas a conferência de produção de 13/10 achou 9 de 15 canais com 56 dias ou mais (o mais antigo de 01/06); o caso real de hoje, portanto, está mais perto de 6 canais não medidos.

---

## 16b. Mudanças: "Outras mudanças" fora da conta Trocas

Estado: aprovado pelo dono em 13/10/2026 . Pasta: `16b-mudancas-outras-mudancas/`. Numeração 16b criada porque a tabela 6.2 do spec lista "Trocas / Mudanças" sem numerar na 6.5b.

### 1. O que a tela responde
"Além das trocas de título e miniatura, o que mais os concorrentes mexeram, e posso confiar no número?" Frase ("12 trocas de título ou miniatura; mais 5 outras mudanças fora desta conta"), duas barras separadas por linha tracejada (a conta da aba acaba na primeira) e uma régua de dias que mostra desde quando o Observatório guarda esses campos (hachura rosa antes do início, coluna depois).

### 2. Roteiro de teste
URL base: `.../16b-mudancas-outras-mudancas/index.html?caso=<caso>&janela=7|30|90&tema=claro`. Respondem ao clique: visão, Janela, Formato do vídeo, Ordenar, tipo, "Mostrar mais N", "Tentar de novo".
1. `caso=trocas`: a visão padrão (marcador de lugar) com a caixa de cima nova. Pergunta: a caixa "Trocas" parece da aba, e não um acréscimo estranho?
2. `caso=tipico` (15 dias de histórico, 5 outras mudanças em 4 vídeos, 12 trocas): trocar a janela para 7 e 90 e ver que a caixa de cima NÃO muda (é fixa em 30 dias e sem filtro de formato). Pergunta: a frase do bloco de baixo traz a janela dele?
3. `caso=magro` (7 dias de histórico, 1 mudança): a régua mostra o pedaço medido; a frase diz "o histórico dessas mudanças começa em dd/mm". Pergunta: um "1" sem a janela enganaria?
4. `caso=extremo` (90 dias, 214 mudanças; conta de cima: 94 mudanças em 65 vídeos, 52 tags): cartão com 5 mudanças, troca de 15 tags, "Mostrar mais". Pergunta: a página fica navegável?
5. `caso=zero` × `caso=nao-medido` (histórico começa em 17/10, exemplo): no primeiro nada mudou (caixa com 0); no segundo o histórico ainda não começou (tudo hachurado). São distinguíveis de relance?
6. `caso=filtro-zero` (filtro Formato com 0): "Nenhuma mudança de <tipo>" com botão para limpar, diferente de zero da janela.
7. `caso=erro` (só a lista nova falha; a conta Trocas segue certa), `caso=carregando`, `caso=vazio` (nicho sem canal: pontilhado, nunca zero), `caso=leitura` (vê tudo igual; só "Sincronizar concorrentes" e "Adicionar canal" desligados, ⓘ diz isso).
8. Chips de tag "acrescentada" e "retirada"; duração mostra "+0:13" e "−0:32" em neutro (sem cor de direção). Pergunta: dá para ler sem a cor?
9. Janela de conferência "entre 12h e 18h" e o ⓘ; ordenar.
10. Celular 390 px (régua de 90 dias legível; alvos de 44 px); tema claro e escuro; Opera.

### 3. Decisões pedidas ao dono (NOTAS) e respostas
1. A descrição entra em algum número? Padrão: 12 = título + miniatura; a descrição fica fora dos dois números. **Resposta (13/10): a descrição NÃO entra em nenhum dos dois números (Trocas = título + miniatura).** Atenção: a aba hoje soma a descrição (`outliers.ts`, `TAB_TITLES.mud`); o 12 do mockup é a conta nova e o implementador decide como migrar.
2. Nomes: aba "Mudanças", seção "Outras mudanças", "o histórico dessas mudanças começa em dd/mm". **Resposta: fica a recomendação.**
3. Idioma como tipo de mudança. Padrão: fora (cinco tipos). **Resposta: idioma fica fora dos tipos.** Pedido novo do dono, fora desta tela: ver seção final "Pedidos novos".
4. Só leitura vê tudo igual. **Não comentou: vale o padrão.**
5. Capítulos (o spec da E1 não lista coluna de capítulos). **Resposta: "ótimo".** Continua válido o pedido ao implementador de confirmar a fonte.
6. Janelas diferentes (histórico de campo é mais curto que o de título e miniatura): mesma janela escolhida e a régua mostra o pedaço medido. **Resposta: "ótimo".**

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r3)
M5: dois ⓘ de 28 x 28 px e seletores de 34 px de altura a 1440 (a 390 todos têm 44); uniformizar com `min-height:44px`. M6: o texto do ⓘ fala do dono em terceira pessoa ("o dono decide"); trocar por "você decide" (some na implementação). M7: fonte do Google bloqueada na medição. Estado: abertas (a NOTAS responde até a r2).

### 5. O que ninguém conferiu
Leitor de tela, Safari, Opera, ordem de teclado completa. Contraste dos pares novos conferido por conta (muted sobre cartão 6,18 e 7,13; borda `--dim` 4,86 e 5,59; zero 4,97 e 4,84). Régua de 90 dias a 390 px foi aberta. Dado real: tudo exemplo.

### 6. Retorno do dono e do uso real
13/10/2026 : aprovado. Respostas: descrição fora dos dois números; nomes recomendados; idioma fora; (5) e (6) "ótimo". Pedido novo: saber se o vídeo tem tradução ou dublagem automática do YouTube. Depois: (a preencher conforme o uso)

**Para o implementador:** o histórico de campo da E1 cobre tags, categoria, duração, formato (capítulos: confirmar a fonte; se vierem da descrição, a data de início pode ser outra); o mockup assume um dia de início de histórico para todos os canais: canal adicionado depois tem início próprio, decidir se a régua é por canal ou global; "o histórico dessas mudanças começa em dd/mm" entra na lista fechada de motivos (6.1.5); a aba hoje conta a descrição; a conta nova não; "entre 12h e 18h" porque a sincronização é a cada 6 h, fuso de São Paulo; 17/10 é data de exemplo.

---

## 17a. Comparar canais com as medidas novas

Estado: aprovado pelo dono em 13/10/2026 , com os nove padrões aceitos. Pasta: `17a-comparar-estados-novos/`.

### 1. O que a tela responde
"Cada canal está subindo ou descendo, e o que eu ainda não posso afirmar?" Leitura rápida (uma frase por lado, ▲ ▼ ＝ ou ○ de "sem direção medida"), tabela do mockup 9 com a linha principal e duas de apoio no grupo Direção, pastilha de estado M8 (● ativo, ⏸ parado, ▼ em queda, ⊗ fora do ar) no cartão de cada lado, e o cartão "Só o seu canal mede" depois da tabela.

### 2. Roteiro de teste
URL base: `.../17a-comparar-estados-novos/index.html?estado=<estado>&tema=claro&barra=0`. Estados: `tipico`, `proprio`, `extremo`, `zero`, `naomedido`, `magro`, `fora`, `nichos`, `queda`, `2027`, `erro`, `vazio`, `leitura`.
1. `estado=tipico` (dois concorrentes): a Leitura rápida aparece na primeira tela (~436 px do topo a 1440, 648 a 390)? Pergunta: em 3 segundos, quem sobe e quem desce?
2. `estado=proprio` (seu canal contra concorrente, com o cartão no fim).
3. `estado=magro` (13/10): "Em queda" não pode existir; "Queda sustentada: medida a partir de 14/12" aparece como linha com hachura em todo canal ativo ou parado antes de 14/12. Pergunta: é informação ou ruído em cada cartão? (Dúvida 8.)
4. `estado=queda` (20/12/2026, primeira data possível) e `estado=2027` (a leitura justa existe): quando (c) vira a principal e (a) desce.
5. `estado=zero` × `estado=naomedido`: no primeiro nada mudou (caixa com 0); no segundo ainda não há medida (hachura). São distinguíveis? "Ainda não existe" (pontilhado) também.
6. `estado=fora`: um lado fora do ar; direção (a) não medida, outras linhas "até 01/11".
7. `estado=nichos`: coluna Diferença com régua por nicho e ⓘ de aviso. `estado=extremo`.
8. `estado=erro`, `vazio`, `leitura` (número privado).
9. Lados A e B no tema claro: o "lado A" (`--lado-n` #5C4710) e "descendo" (`--dir-dn` #8A5A00) ficam quase da mesma cor (medido ~1,4:1); a forma (letra × quadrado ▼) separa. Pergunta: confunde?
10. ⓘ do rótulo "Canal inteiro" fica sozinho numa linha abaixo (órfão) a 1440 e a 390 no `2027`.
11. Celular 390 px (a tabela vira cartões); tema claro e escuro; Opera.

### 3. Decisões pedidas ao dono (NOTAS) e respostas
Resposta do dono ao aprovar: os nove padrões aceitos. Pergunta transversal respondida: "＝" cinza com "estável"; âmbar para "parado"/"em queda".
1. Quando (c) vira a principal? Quando existir para os dois lados (3 longos fechados em cada período de 90 dias); se só para um lado, (a) continua principal para os dois.
2. "Parado" é o ＝ ou o estado M8? Ambos (＝ neutro; âmbar só no estado M8 e em "em queda"); resposta transversal acima.
3. Data do deploy da E2 que libera "Primeiras 24 horas": o exemplo usa 17/10/2026. **Resposta do controlador (aprovação): a data real é 13/10/2026 (promoção do Lote 1 às 12:27).**
4. Nichos diferentes: manter a coluna Diferença (com ⓘ de aviso).
5. Canal fora do ar: direção (a) não medida e outras linhas "até 01/11".
6. Dois lados com idades diferentes de M7: não calcular "x" e dizer "Leituras diferentes".
7. Percentual de M4 com 10 ou mais: cinza ao lado de "3 de 12".
8. "Queda sustentada: medida a partir de 14/12" como linha em todo cartão enquanto a data for anterior.
9. Longos publicados: sem piso (vale só ±10%, 3 contra 4 já é ▼).

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r3)
1. O ⓘ do rótulo da linha principal fica órfão (colocar dentro do mesmo `span`, `white-space: nowrap`). 2. Tema claro: lado A e "descendo" quase da mesma cor; vem do lote 1 aprovado, decisão do dono. 3. `erro` a 390: a Leitura rápida começa a 810 px porque o aviso vem antes (certo, só registrado). Estado: abertas (a r3 é a última).

### 5. O que ninguém conferiu
Leitor de tela, Safari, Firefox, Opera; ordem de Tab só testada em 5 de 13 estados; contraste do texto sobre hachura medido pelo token, não por pixel; movimento reduzido e zoom; capturas do autor em 1440 claro e 390 escuro não existem em `shots/`. Dado real: tudo exemplo.

### 6. Retorno do dono e do uso real
13/10/2026 : aprovado, nove padrões aceitos. (a preencher conforme o uso)

**Para o implementador:** toda medida chega como `{ estado: 'medido', valor, n, janela }` ou `{ estado: 'nao_medido', motivo, desde? }`; trocar a data de exemplo 17/10/2026 da E2 por **13/10/2026** (data real que libera "Primeiras 24 horas"); "ainda não existe" e "não medido" são retornos diferentes da API; marca de 24/08/2026 pelas datas da janela (`inicio <= 2026-08-24 <= fim`), não pela data de hoje; régua usa 5% a 95% da largura; as classes `.fora` e `.dir` já existem em `a4.css`, não reaproveitar.

---

## 17b. Outliers por views aos 7 ou 30 dias, selo "ao vivo ou estreia"

Estado: aprovado pelo dono em 13/10/2026 , com os seis padrões aceitos. Pasta: `17b-outliers-v7-v30/`.

### 1. O que a tela responde
"Quais outliers foram melhor aos 7 ou aos 30 dias, e quantos já têm essa medida?" Seletor "Ordenar por" (multiplicador, 7 dias, 30 dias), duas colunas novas com barra de views, faixa de cobertura (uma casa por vídeo da lista, "3 de 11 têm 7 dias") e selo "ao vivo ou estreia" para vídeo que fica fora do cálculo do normal.

### 2. Roteiro de teste
URL base: `.../17b-outliers-v7-v30/index.html?caso=<caso>&ordem=mult|v7|v30&tema=claro`.
1. `caso=padrao` (hoje: 3 de 11 têm 7 dias, 0 de 11 têm 30; vizinha "Estourou e parou"): olhar a frase, a faixa de cobertura e as duas colunas. Pergunta: em 3 segundos, quantos vídeos já têm a medida?
2. `caso=v7` (o caso magro real): 3 medidos no alto, 8 no fim "Sem a medida". Usar o seletor "Ordenar por" de verdade.
3. `caso=nao-medido` (ordenado por 30 dias, 0 medidos): a frase diz quando a primeira fecha, régua do tempo, botão "Voltar ao multiplicador"; a lista segue o multiplicador. Pergunta: a frase e a nota repetem o mesmo (melhoria M1)?
4. `caso=futuro` (20/12/2026, exemplo marcado): 9 de 14 medidos, o uso que a tela terá.
5. `caso=extremo` (63x passa da régua de 50x, título e canal longos, 1,2 mi contra 312 views): a barra linear de um vídeo achata os outros; o número distingue. Pergunta: linear ou raiz quadrada? Atenção: aos 7 e 30 dias as barras de colunas diferentes ficam do mesmo tamanho (cada coluna tem escala própria).
6. `caso=zero` × `caso=nao-medido`: dois vídeos de zero medido (caixa vazada com 0, privados ou agendados na primeira semana) ao lado de não medido (hachura). São distinguíveis de relance?
7. `caso=erro`: as duas colunas novas "não carregou" (não "não medido"), opções desabilitadas, "Tentar de novo"; o multiplicador segue. `caso=vazio`. `caso=leitura` (igual a `v7` com selo "Só leitura"; candidato a sair).
8. Selo "ao vivo ou estreia": o vídeo pode ser outlier com o selo; a linha acima da faixa diz quantos saíram da conta. Pergunta: o chip parece clicável a 390 (M3)?
9. A 1100 px ou menos o menu some e a tabela cabe; abaixo de 900 vira cartão.
10. Celular 390 px; tema claro e escuro; Opera.

### 3. Decisões pedidas ao dono (NOTAS) e respostas
Resposta do dono ao aprovar: os seis padrões aceitos.
1. Um vídeo ao vivo ou estreia pode ser outlier? Padrão: pode, com o selo. Alternativa: tirar da lista e só contar.
2. Barra linear contra o maior da lista naquela idade. Alternativa: raiz quadrada.
3. Os sem medida ficam no fim, visíveis, na ordem do multiplicador. Alternativa: seção recolhida.
4. "Só leitura": a tela não tem número privado; o estado `leitura` é igual a `v7` com selo (pode sair se o dono confirmar que não existe).
5. Nome na tela: "multiplicador" (como hoje) ou "múltiplo" (spec).
6. Duas colunas novas sempre visíveis (a faixa já as compara).

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r2)
M1: `nao-medido`: a nota repete a frase de topo. M2: `erro`: frase de topo e aviso dizem o mesmo. M3: a 390 o chip "ao vivo ou estreia" fica sozinho e parece filtro clicável. M4: `leitura` a 390 "Só leitura" quebra em duas linhas (vale só se o estado ficar). M5: barras de colunas diferentes com o mesmo comprimento no `extremo` a 390 (cada coluna tem escala; considerar escala única ou legenda). M6: borda do botão comum com contraste 1,4 a 1,7:1 (herdado do `.btn` do lote 1). M7: trilho da barra de views 1,37 a 1,69:1 contra a linha. Estado: todas abertas.

### 5. O que ninguém conferiu
Leitor de tela, Safari, Opera (sem `color-mix`); `futuro` e `leitura` a 1440 e o tema oposto só medidos; movimento reduzido, impressão e zoom de 200%; contraste das listras da hachura (a borda e a palavra carregam o significado). Dado real: tudo exemplo, construído para refletir o calendário real (7 dias desde 10/10; 30 dias desde 02/11; 39 vídeos desde 03/10).

### 6. Retorno do dono e do uso real
13/10/2026 : aprovado, seis padrões aceitos. (a preencher conforme o uso)

**Para o implementador:** as medidas valem só para os outliers que a tela já lista ("3 de 11" é "3 dos 11 outliers", não de 303 vídeos); conta M1 com `viewsAtAge` nas idades 7 e 30, lidas de `competitor_video_marks`; motivos na ordem de teste: descoberto tarde, antes de 03/10, idade menor que N, leituras vizinhas a mais de 36 h (este não aparece nos exemplos; sugerido "leituras distantes"); ordem entra na URL (`sort=v7|v30`); vídeo `was_live` fica fora do cálculo do normal; erro: opções desabilitadas.

---

## 17c. Insights: quem sobe e quem desce no nicho

Estado: aprovado pelo dono em 13/10/2026 , com os sete padrões aceitos. Pasta: `17c-insights-direcao-nicho/`. Pendência: copiar `a4.css`, `a4-comum.js`, `lote.css`, `lote.js` de `../../2026-10-13-a5-lote-1/` para a pasta antes de congelar.

### 1. O que a tela responde
"Neste nicho, quem sobe e quem desce, cada canal contra ele mesmo?" Um cartão novo da aba Insights, depois de "Você no nicho": frase, barra de contagem (▲ ▼ ＝ ◌ proporcionais) e régua desdobrada com um canal por linha, na mesma escala de −60% a +60%. Só existe com um nicho escolhido.

### 2. Roteiro de teste
URL base: `.../17c-insights-direcao-nicho/index.html` (estados e a divisão por 0 pela barra "Estados do mockup"; `?leitura=a|b|c` escolhe a leitura; o nome dos parâmetros de estado não está registrado nas NOTAS). Neste mockup o servidor TEM de ser na raiz dos mockups (lê a base do lote 1 por caminho relativo).
1. Estado `tipico` (7 canais: 3 sobem, 2 descem, 1 estável, 1 sem 56 dias): olhar a frase e a barra de contagem. Pergunta: em 3 segundos, quem sobe e quem desce?
2. Estado `leituras` (uma linha aberta): botão ▾ de cada canal mostra as três leituras. Trocar a leitura a, b, c pelo seletor; o foco vai para o botão da leitura nova.
3. Estado `videos` (leitura b: Pedro no Mundo "não medido, 2 longos") e `justa` (leitura c, nenhum medido, com data 01/04/2027): a frase é longa (4 linhas a 390, M1). Pergunta: a frase se lê?
4. Estado `extremo` (+340% fora da escala, −60% na borda, −78% fora, três empatados em +24% ("2º", "2º", "2º", próximo "5º"), +10% que vem de 9,68%, nome de 69 caracteres). Pergunta: setas de "fora da escala" e posição de competição são entendidas?
5. Estado `zero`: "0 contra N", "N contra 0", "0 contra 0" ao lado de um não medido; botão "Divisão por 0" alterna padrão (não medido, sem base para comparar) e alternativa (▲ "de 0" em 1º e ＝ "sem mudança"). Pergunta: a regra padrão assusta?
6. Estado `nao-medido` (todos hachurados com progresso e a data de cada um; o primeiro fecharia em 27/11), `magro` (nicho IA, 2 canais), `um-canal`, `sem-dado`, `sem-dado-leitura` ("Adicionar canal" desabilitado e diz por quê), `erro`.
7. Botão "Cor do ＝": cinza com "estável" (aprovado) × âmbar com "parado". O dono já respondeu: cinza com "estável".
8. Posição do cartão: começa bem abaixo da dobra (frase a ~660 px do topo a 1440; primeiro canal a ~915). Pergunta: subir para o topo da aba?
9. Celular 390 px (≈151 px por linha, cartões longos, `justa` a 390 tem 1.583 px de cartão); tema claro e escuro; Opera (o símbolo ◌ depende da fonte reserva).

### 3. Decisões pedidas ao dono (NOTAS seção 5) e respostas
Resposta do dono ao aprovar: os sete padrões aceitos. Fato conferido em produção (13/10) pelo controlador: 9 de 15 canais têm 56 dias ou mais de retrato diário (o mais antigo de 01/06).
1. "Parado" do dono é o ＝ ou o M8? **Resposta transversal: "＝" cinza com "estável"; âmbar para "parado"/"em queda".**
2. O seu canal entra na régua? Padrão: não, com a linha "fora desta régua" e o ⓘ.
3. Quantos canais têm 56 dias hoje? **Conferido: 9 de 15.** O estado `tipico` (que supõe canais antigos com registro anterior a 03/10) é plausível; `nao-medido` não é o caso de hoje.
4. "N contra 0" e "0 contra 0": padrão "não medido, sem base para comparar", fora de posição e contagem. Alternativa: ▲ "de 0" e ＝.
5. Empate: posição de competição ("2º", "2º", "2º", "5º"). Alternativa: "2º ao 4º".
6. Escala de −60% a +60% (a de Comparar canais). Alternativa: logarítmica.
7. O cartão sobe para o topo da aba Insights? Padrão: continua depois de "Você no nicho".

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r2)
M1: frase de `justa` é a mais pesada (4 linhas); sugestão "Nenhum canal do nicho Viagem tem a medida aos 30 dias de vida ainda: o primeiro fecha em 01/04/2027." M2: o símbolo ◌ do segmento "não medidos" quase não se vê; trocar pelo quadradinho hachurado do seletor. M3: zero medido e "sem base" com argumentos opostos ("0 contra 41.000" é ▼ −100%, "3.100 contra 0" é não medido); acrescentar o caso espelho na pergunta 4. M4: estados cheios de "não medido" repetem o mesmo texto; com todos no mesmo motivo, um bloco só. M5: pergunta 5.7 (subir ao topo) é a decisão que mais muda a leitura de relance. M6: frase da leitura b a 1440 quebra deixando "medido." sozinho. Estado: abertas (a NOTAS responde até a r1).

### 5. O que ninguém conferiu
Leitor de tela, Safari, Firefox, Opera, toque real; fechar o ⓘ por toque fora do balão a 390; contraste do texto sobre a hachura calculado, não lido do pixel. Capturas de `magro`, `um-canal`, `sem-dado` e os cruzamentos 1440 claro e 390 escuro só por medida e texto. Não resolvido pelo desenhista: tamanho do cartão com 40 ou mais canais no nicho (regra do lote 1: mostrar 10 e "Mostrar mais N"). Dado real: tudo exemplo.

### 6. Retorno do dono e do uso real
13/10/2026 : aprovado, sete padrões aceitos; "＝" cinza com "estável". (a preencher conforme o uso)

**Para o implementador:** novo componente irmão de `you-in-niche.tsx` em `_insights/`, view-model `directionOfNiche`; teste de borda obrigatório: 9,68% dá ▲ e "+10%", 9,4% dá ＝ e "+9%"; o aviso de 19/10 e a "mesma idade" de 01/04/2027 são constantes com teste (fixture com data relativa); ordenação do maior arredondado ao menor, não medidos no fim; o filtro Longos/Shorts não muda o cartão; manter o nó `<p aria-live="polite">` e trocar só o texto (o mockup refaz o cartão com `innerHTML`); 40 ou mais canais: mostrar 10; nomes de canais e datas são exemplo.

---

## 18. Aviso "banco chegando ao limite"

Estado: REPROVADO pelo dono em 13/10/2026, em ajuste: o roteiro vai mudar para percentual. Os itens do roteiro abaixo, escritos em MB, são do desenho anterior e NÃO são definitivos; refazer o roteiro quando o desenho novo existir. Pasta: `18-aviso-banco-limite/` (retorno em `RETORNO-DO-DONO-13-10.md`).

### 1. O que a tela responde
"O banco vai me deixar na mão, e quando?" Uma pastilha na faixa de frescor ("Banco: 216 de 500 MB" com minibarra e símbolo); em alerta a borda e o símbolo mudam de forma (triângulo, octógono). Abre um painel com a barra de 0 a 500 MB com cortes de 350 e 425 desenhados, a régua do tempo (0 a 1 ano, zona de 90 dias), dois números ("Livre até 500 MB", "Cresceu em 28 dias"), a quebra por tipo (concorrentes, seu canal, resto do site) e os lotes exportados pendentes de confirmação.

### 2. Roteiro de teste
URL base: `.../18-aviso-banco-limite/index.html?caso=<estado>&painel=aberto|fechado&tema=claro` (os nomes exatos dos `caso` não estão no texto das NOTAS; usar o seletor da barra "Estados do mockup").
1. Estado verde (216 MB): painel fechado, só a pastilha. Pergunta: quieta quando está bem? "exemplo" visível mesmo com o painel fechado?
2. Amarelo (360 MB, "Enchendo"; "limite em set/2028"), vermelho por tamanho (440 MB, "Quase cheio"), vermelho por previsão (392 MB, 78%, "Enche em 80 dias" com o tamanho em âmbar), acima do limite (521, "21 MB acima"). Pergunta: em 3 segundos dá para saber se há risco e quando? Os rótulos "Enchendo" < "Quase cheio" < "Acima do limite" são distintos?
3. Zero medido (não cresceu, 0,0 MB, "0 lotes", caixa vazada) × previsão não medida (6 dias de 14) × sem leitura hoje (hachura, último valor "12/10: 215 MB, leitura de ontem") × erro ao ler ("Tentar de novo", região `aria-live`: "Tentou às 14:41: o banco ainda não respondeu") × ainda sem medida. Pergunta: a hachura rosa diz "não sei" e nunca "está bem"? Zero medido e verde se distinguem fechados?
4. Lotes a confirmar ("2 lotes a confirmar" com relógio; cartão com borda tracejada à esquerda, três passos feito/falta, idade escrita). Pergunta: a tela deixa claro que confirmar é por comando, só do dono?
5. Abrir e fechar o painel nos estados calmos (a escolha é lembrada); nos de alerta abre sozinho. Pergunta: o padrão por estado acerta?
6. Zonas da barra (símbolos triângulo e octógono, listras na vermelha) em cinza.
7. Régua do tempo: losango dentro da zona de 90 dias; "depois de 1 ano"; zero crescimento sem losango ("não está crescendo"). A zona vermelha de 90 dias aparece em vermelho cheio mesmo em estados calmos (melhoria 1): pesa?
8. Só leitura: não vê nada, nem pastilha desativada.
9. Celular 390 px: pastilha "Banco: N de 500 MB" não quebra no meio; "exemplo" fica sozinho numa linha (melhoria 4).
10. Tema claro e escuro (âmbar e laranja de "seu canal" parecidos no claro); Opera.

### 3. Decisões pedidas ao dono (NOTAS seção 3)
1. Só leitura: nada na tela (adotado) ou uma linha dizendo que existe?
2. Erro ao ler o banco: hachura de "não medido" (adotado) ou família do erro?
3. Lote pendente há muito tempo vira alerta? Adotado: neutro, só a idade escrita. Sugestão: amarelo depois de 14 dias.
4. Mostrar quanto cada lote liberaria? Deixado de fora (a tabela guarda registros, não bytes).
5. Quebra em três partes (acréscimo "resto do site") para fechar com o total; o pedido dizia concorrentes × canal próprio.
6. (Resolvida na r1.)
Respostas do dono: não registradas.

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r3)
1. Régua do tempo em estado calmo: zona vermelha de 90 dias em vermelho cheio é o bloco mais forte da tela mesmo sem risco; usar contorno e listras. 2. Acima do limite: "21 MB acima" só existe em texto; desenhar um tracinho além da borda direita. 3. Barra em "erro" e "vazio": zonas em saturação cheia contra frase neutra; baixar a opacidade. 4. "exemplo" a 390 px fica sozinho abaixo da pastilha (só mostra). 5. Âmbar e laranja de "seu canal" parecidos no claro (herança dos tokens do lote 1). 6. Motivo repetido em "previsão não medida". Estado: todas abertas.

### 5. O que ninguém conferiu
Contraste medido no navegador só na r3 (72 cruzamentos medidos; o NOTAS ainda diz que não foi medido); foco por teclado em todos os controles; popover do ⓘ em tela de toque real; leitor de tela, Safari, Opera. Dado real: tudo exemplo. Risco assumido: o spec diz "a reta dos últimos 28 dias" sem dizer o método.

### 6. Retorno do dono e do uso real
13/10/2026: não aprovado. Palavras dele: "Acho que tem que fazer ajuste. 500 MB é para tudo, não é só para isso, né? Então talvez exibir percentual, mas não falar os valores e tal. Talvez até ter um botão ou cron em quando chegar em algum percentual mandar para o nosso backup no NAS eventualmente, né? Quando chegarmos nessa parte."
Interpretação do controlador, a confirmar com ele na reapresentação: (1) o limite de 500 MB é do banco inteiro do site, não do Observatório; (2) a leitura principal passa a ser percentual do limite ("Banco do site: 43% do limite") na pastilha, barra, frase e régua, com MB só dentro do ⓘ; (3) os cortes viram 70% (350) e 85% (425); a previsão segue em dias e data; (4) "Quem ocupa" mostra a parte de cada um em percentual do banco e do crescimento, deixando explícito que o Observatório é uma parte; (5) botão ou cron que manda ao backup no NAS ao chegar a um percentual é da fase de manutenção: aqui só um lugar reservado marcado "ainda não existe", se couber sem poluir; (6) a palavra "lote" é jargão interno; padrão adotado até ele dizer outra coisa: "exportações a confirmar" (sem resposta do dono). Quando o ajuste chegar, o roteiro passa a testar percentual: a pastilha diz o percentual sem MB? o painel deixa claro que o limite é do site inteiro? a parte do Observatório está identificada? "exportações a confirmar" é entendido? (a preencher conforme o uso)

**Para o implementador:** dado em `obs_db_size_daily` (`day`, `db_bytes`, `competitor_bytes`, `own_bytes`, gravada pela tarefa `tamanho_do_banco` às 05:00 de São Paulo) e lotes em `obs_archive_batches`; "resto do site" = `db_bytes − competitor_bytes − own_bytes`; só desenhar com `can_edit_site(site_id)`; "sem leitura hoje" = não existe linha com `day` igual ao dia de São Paulo (nunca derivar da última linha antiga); amarelo a partir de 350 MB, vermelho a partir de 425 MB ou previsão a 500 MB em menos de 90 dias (só com 14 dias ou mais de leitura); testes de borda 349/350, 424/425, 89/90 dias; escolher e documentar o método da previsão (dois pontos ou mínimos quadrados); crescimento zero ou negativo é "sem data"; as datas "21/10" e "27/10" do exemplo e os 14 dias de leitura são exemplo.

---

## 20. Comentários de destaque do vídeo de concorrente

Estado: em ajuste, o roteiro pode mudar. Última revisão (r5): 1 bloqueio (B1: vídeo pequeno, 7 dias: quem "saiu dos 12" tinha mais curtidas do que quem ficou como "mais curtido") e 2 "corrige" (C1: lote completo diz "nenhum canal grande entre os 20 mais curtidos" num vídeo de no máximo 16 comentários principais; C2: NOTAS com números que a tela já não mostra). Pasta: `20-comentarios-de-destaque/`.

### 1. O que a tela responde
Na página do vídeo: "O que o público destacou neste vídeo, e o criador respondeu quem?" Na página do canal: "Em quantos vídeos o criador responde?" Uma fileira de 12 casas (uma por comentário guardado) com cor e símbolo do motivo (mais curtido, com o criador, canal que você acompanha, canal grande), barra "12 de 100", três abas de idade (1, 7, 30 dias) que são abas de estado, cartões de comentário com a resposta do criador presa. Na página do canal, o bloco "O criador responde" e a lista "O que o criador respondeu".

### 2. Roteiro de teste
URL base: `.../20-comentarios-de-destaque/index.html?caso=<caso>&idade=1|7|30&todos=1&tema=claro`. Casos (nomes dos arquivos de captura): `tipico`, `completo`, `novo`, `zero`, `desligados`, `naocoletado`, `antes`, `carregando`, `erro`, `extremo`, `leitura`, `leitura-privado`, `canal`, `canal-fecha`, `canal-nm`.
1. `caso=tipico` (canal Leo, vídeo publicado 06/10, hoje 13/10; só existem retratos de 1 e 7 dias): fileira de casas, legenda com zero medido ("nenhum canal que você acompanha comentou", caixa 0) e não medido ("1 autor com inscritos ocultos", hachura). Pergunta: em 3 segundos, quem está aqui e por quê?
2. Trocar as abas 1, 7 e 30 dias: cada aba mostra a forma do seu estado antes do clique (guardados, zero, desligados, não coletado, antes da coleta, "fecha em dd/mm"). Em cada cartão, as curtidas nas três idades; "fora dos 12" em hachura para comentário que não estava no dia 1. Pergunta: "fora dos 12" é entendido como "não sabemos", e não como zero?
3. Os quatro estados sem comentário: `zero` (caixa vazada com 0), `desligados` (hachura e balão cortado, "motivo do canal"), `naocoletado` (hachura e relógio, "motivo nosso", dois casos), `antes` e `canal-fecha` (pontilhado, "fecha em dd/mm"). Pergunta: as quatro formas se distinguem sem ler?
4. `caso=extremo` (12 cartões de uma vez; os quatro motivos, texto longo, ofensivo, endereço, outro idioma, árabe/RTL, emoji, "saiu do YouTube", criador respondeu "não se sabe", foto que não carrega): texto de terceiros em bloco rebaixado e neutro; endereço só como texto ("Este comentário tem um endereço. Aqui ele é só texto, não abre."); "Ver tudo" e "cortado aos 2.000 caracteres". Pergunta: o texto ofensivo é mostrado sem destaque?
5. Cinco cartões por vez e "Mostrar os outros 7": o foco vai ao primeiro cartão revelado, o botão vira "Mostrar só os 5 primeiros". A casa da fileira revela tudo e leva ao cartão. Pergunta: cinco é o número certo?
6. Resposta do criador: faixa azul com seta, marca do canal dele e selo "criador"; "Não vimos resposta do criador" (caixa vazada) e "Não sabemos se o criador respondeu" (hachura com "5 das 62 respostas"). Pergunta: a tela nunca diz "não respondeu"?
7. Autor de destaque: duas escadas de 3 degraus (tamanho 100 mil a 1 mi, 1 a 10 mi, mais de 10 mi; vezes este canal 10 a 100, 100 a 1.000, mais de 1.000) e "Razão não medida". Quatro estados do autor: com identidade, foto que não carrega, "Um espectador", canal grande sem nome.
8. `caso=completo` (todos os comentários do vídeo): "12 de 37 (todos)" mistura base (principais e respostas)? E o C1 em ajuste.
9. `caso=leitura` (sem o texto: cadeado, "Texto reservado") e `caso=leitura-privado` (com o texto, sem o nome: "Um espectador"): a faixa do topo diz o que a pessoa não vê e quem vê.
10. `caso=canal` (bloco "O criador responde": "5 de 14", 14 casas, as 3 sem retrato de 30 dias fora da conta, pontilhadas), `canal-fecha`, `canal-nm` ("11 sem retrato de 30 dias" são 11 de 14 vídeos: soa como defeito grave?).
11. Pastilha "Não veio mais do YouTube desde hoje (13/10)" e o botão "Ver na fila Saíram do YouTube".
12. Celular 390 px: fileira em 2 fileiras de 6, 44 px; a página chega a 9.240 px de altura; tema claro e escuro; Opera.

### 3. Decisões pedidas ao dono (NOTAS seção 3)
1. Palavra "lidos". Padrão: "guardamos 12 dos 100 primeiros comentários que o YouTube mostra, na ordem de relevância dele".
2. Cores dos motivos: violeta (`--tier-high`) para "canal que você acompanha" e coral (`--tier-top`) para "canal grande" (nos vídeos de concorrente essas cores não significam faixa de desempenho). Alternativa: matiz novo e fixo (quatro variáveis em `c20.css`).
3. "Fecha em dd/mm" do M11 como "ainda não existe" (pontilhado), e hachura só para "poucos vídeos com retrato".
4. Cinco cartões por vez, e não dez.
5. Pergunta 41: nome e foto só de quem edita nos 28 dias; quem vê só o texto vê "Um espectador". Desenhado no padrão, o mais restrito.
6. Perguntas 9 e 10 (respondidas em 12/10): autor de destaque e divisão 4/2/resto, como o spec fechou; nenhuma tela usa "verificado" nem "famoso".
7. O canal acompanhado mantém o nome depois dos 28 dias (pergunta 21): "canal do seu cadastro; o nome fica". Se mudar, a linha vira "Um canal que você acompanha comentou".
8. O dono comentando (`canal_proprio`): sem cartão; selo "seu canal" com "Você comentou aqui". Se quiser cartão e casa próprios, é um quinto motivo.
Respostas do dono: não registradas.

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r5)
S1: texto do comentário da Carla no Pho cita "sábado" (03/10) antes de o vídeo existir (06/10); trocar por "hoje cedo" ou "ontem". S2: empates em "Mais curtido" (6 e 6; 2, 2 e 2). S3: "12 de 37 (todos)" mistura base; sugestão "12 de 15 principais, mais as respostas". S4: "11 sem retrato de 30 dias: coleta falhou ou veio tarde" são 79% dos vídeos; dizer "o motivo está em cada vídeo". S5: textos repetidos entre vídeos do exemplo. S6: casa vazia, textos de duas linhas e altura de 9.240 px a 390 px. Estado: abertas (e o bloqueio e os dois "corrige" da r5 estão em ajuste).

### 5. O que ninguém conferiu
Leitor de tela, Safari, Opera, fontes reais (Inter, JetBrains Mono, Fraunces), escala de cinza refeita, tema claro a 1440 e escuro a 390, Home/End das abas e foco do "Mostrar os outros", movimento reduzido, dia da semana das datas de exemplo (conferido só em um comentário). Contraste dos pares novos (símbolo colorido sobre fundo rgba) só por inspeção dos tokens. Dado real: tudo exemplo; a coleta (E14) só existe depois do passo 0 da E17.

### 6. Retorno do dono e do uso real
Sem registro de aprovação. (a preencher conforme o uso)

**Para o implementador:** nada aparece sem o estado da coleta (`ok`, `sem_comentarios`, `desligados`, `erro`; sem linha é "não coletado" ou "antes da coleta"); marcos de 1, 7 e 30 dias com tolerância de coleta de 3, 10 e 37 dias; "fora dos 12" é não medido, não zero; texto de terceiros nunca como HTML nem `href`, `dir="auto"`, corte de 2.000 caracteres vem do dado (`truncated`); texto só para quem edita ou tem "ver desempenho privado"; nome, foto e id de canal só para quem edita, nos 28 dias (tabela própria, policy `can_edit_site`); teste de saída com nome sentinela fora do HTML e do RSC depois dos 28 dias; foto `<img>` com URL do YouTube e `onerror` caindo na inicial; datas 06/10 (publicação) e marcos 07/10, 13/10, 05/11 são exemplo.

---

## 21. Ritmo por hora

Estado: segurado. O desenho está pronto, mas só vai ao dono depois da medição do item 140 (14 dias depois de a leitura horária entrar em produção, spec 04, tabela 6.5b, linha 162). A última revisão (r3) tem um bloqueio só de calendário (B5), com zero defeito de desenho aberto. Pasta: `21-ritmo-por-hora/`. O desenho pressupõe que a medição dirá: views bloqueadas, curtidas e comentários liberados; se disser outra coisa, só mudam as tabelas `D.perfil` (regra "views") e o texto do ⓘ de views.

### 1. O que a tela responde
"A que horas o público deste canal reage, e quanto eu posso confiar nisso?" Uma frase com a janela de pico e quantas vezes a média, um perfil de 24 horas (barras) e um mapa de dia da semana por hora (cinco degraus fixos, nunca degradê), com a janela de pico atravessando os dois; a base (dias de vídeo, vídeos, horas lidas) fica à vista. Há ainda a curva das primeiras 72 horas do canal e do vídeo.

### 2. Roteiro de teste
Só faz sentido quando a leitura por hora tiver os 14 dias de medição. Enquanto isso, o exemplo é de 15/01/2027, 14:40 (a leitura por hora só existe a partir de 14/10/2026). URL base: `.../21-ritmo-por-hora/index.html?tela=ritmo|canal-72h|video-72h&estado=<estado>&tema=claro`. Estados do ritmo: típico, extremo, zero medido, não medido (poucos vídeos; horas sem leitura; oculto pelo canal; leitura recém-começada), degraus, só Shorts, canal do dono, fase lançamento, sem dado ainda, erro ao abrir, leitura parada, carregando, comparar (com os dois medidos e com o meu não medido). Nomes de arquivo: `estado-tipico`, `-extremo`, `-zero`, `-nao-medido`, `-cobertura`, `-comecou`, `-degraus`, `-shorts`, `-dono`, `-lancamento`, `-vazio`, `-erro`, `-parado`, `-oculto`, `-carregando`, `-comparar-ok`, `-comparar-nc`.
1. `tipico`: frase-resumo, perfil e mapa com a moldura de 2 px e ▲ no pico. Pergunta: em 3 segundos, a que horas reagem? A base é visível?
2. Seletores (contador, formato, fase, período, comparar, janelas A e B) funcionam e vão para a URL; o foco volta ao botão clicado. Pergunta: o seletor muda o desenho de modo previsível?
3. `extremo` (3,7x de pico, 38 intervalos fora do mapa, 212 leituras em que o contador diminuiu): cartões de cobertura.
4. Cinco degraus com o valor escrito na casa; pico só com 1,5x ou mais (abaixo disso: moldura pontilhada e "janela mais forte"). Pergunta: o limiar de 1,5x serve?
5. Zero medido (caixa vazada com 0) × não medido (hachura rosa, barra de altura total) × ainda não existe (pontilhado): distinguíveis de relance? Uma hora sem leitura deixa o bloco inteiro de 3 horas "não medido" a 390.
6. Comparar: janelas A e B de 2 horas trocáveis ("21 às 23 contra 3 às 5"); `comparar` com o meu não medido (o caso real) mostra "não comparável".
7. Canal do dono (36 views em 90 dias, o único número real): migalha "YouTube › Seu canal".
8. Curva de 72 horas no canal e no vídeo (`canal-72h-estado-*`, `video-72h-estado-*`): relógio embaixo das horas, faixa cinza de 0h às 6h, hora sem leitura em hachura com a linha cortada, "metade em N h". Pergunta: a linha azul sólida (sujeito) e a marrom tracejada (referência) são entendidas?
9. Mapa por teclado (`role="grid"`): um só ponto de Tab; setas, Home e End; linha de leitura `aria-live`; "Ver como tabela" com as 168 casas.
10. Celular 390 px: mapa vira 8 blocos de 3 horas de 44 x 44 px; quatro seletores viram "Mostrando: ... Mudar". Tema claro e escuro; Opera (o mapa usa `subgrid`, Chrome 117+, Safari 16+; sem plano B o desenho quebra).

### 3. Decisões pedidas ao dono (NOTAS)
1. Quando a janela "não tem pico claro"? Padrão: abaixo de 1,5x a média. Alternativa: 1,3x ou 2x.
2. Motivo "cobertura baixa" (mais de 20% das horas do período sem leitura) como quinto texto da lista fechada de 4.7.8. Confirmar.
3. Hora do bloco a 390 px com uma hora sem leitura: bloco inteiro "não medido". Alternativa: calcular com as horas lidas e dizer a base.
4. Data provável de "passa a existir" como extrapolação do ritmo dos últimos 45 dias ("se o canal seguir no ritmo de agora"). Prefere não mostrar data acima de 6 meses?
5. A medição de "degraus" vale também para a curva de views? Padrão: a curva aparece, com aviso de atraso das primeiras horas.
6. Vídeo com menos de 72 horas: não desenhado; proposta de mostrar o acumulado absoluto, sem "metade em N h".
7. Seletor de fase na tela do dono (base não medida por meses): mantido visível.
Mais uma, da revisão r3 (M-r3-4): o nome da aba "Tração depois de publicar" ("tração" não é palavra que o dono usa). Respostas do dono: não registradas.

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r3)
M-r3-1: "As 72 horas ainda não começaram a ser lidas" e "Lidas N de M horas" usam "lida", que a convenção proíbe fora do cartão de cobertura; trocar por "A leitura das 72 horas ainda não começou". M-r3-2: ~150 px vazios sob a frase-resumo ao lado da régua a 1440 (subir a régua). M-r3-3: texto "Horário de São Paulo, a partir da publicação" a 14 px dos rótulos "18:00" no eixo da curva; dar 8 px a mais. M-r3-4: nome da aba "Tração depois de publicar". Estado: abertas. As melhorias da r2 (M1 anel só no foco, M2 aviso x erro, M5 cor estável) foram aplicadas (itens 15, 16, 17 das decisões).

### 5. O que ninguém conferiu
Leitor de tela, Safari, Opera; contraste das barras do perfil (3,1:1 no claro, 4,4:1 no escuro; a barra do pico contra as demais mede só 1,4 a 1,7:1, por isso há moldura e ▲); o texto dos ⓘ não passou por revisão de redação. Dado real: tudo é gerado por semente (o mapa e o registro de dias somados vêm de 4.7.3 e 4.7.4 em produção). Risco assumido: a medição do item 140 pode contradizer o desenho (se as views andarem em degraus de horas, a curva de views perde sentido).

### 6. Retorno do dono e do uso real
Ainda não visto pelo dono (segurado). (a preencher conforme o uso)

**Para o implementador:** a leitura por hora só existe a partir de 14/10/2026 neste mockup, e o "hoje" do exemplo é 15/01/2027; esperar a medição do item 140 antes de aprovar; fatia só com 28 dias de vídeo e 3 vídeos, linha do dia da semana só com 4 dias de vídeo; janela de pico de 2 horas seguidas pode cruzar a meia-noite (a moldura vira duas); `subgrid` precisa de plano B; "vez" até 1,9 e "vezes" de 2,0 em diante.

---

## 22. Perguntar a uma IA

Estado: aprovado pelo dono em 13/10/2026 ("gostei bastante"), com os nove padrões aceitos (liberado antes pelo revisor de UX, r2). Pasta: `22-perguntar-a-uma-ia/`.

### 1. O que a tela responde
"O que vai sair do site, cabe numa mensagem, e o que ficou de fora?" Um botão "Perguntar a uma IA" na faixa de topo de 11 telas abre um diálogo modal: frase-resumo ("Pacote da tela Comparar: 7 tabelas, 12.400 caracteres, nada privado"), barra de tamanho com a marca de 30.000, quatro linhas fixas "o que ficou de fora" (tamanho, dado privado, texto de comentários, chaves e links), prévia do texto (início e fim, com o meio dobrado), campo opcional "Minha pergunta" (teto de 1.000 caracteres) e o aviso fixo de que o texto sai do site, colado em cima dos botões "Copiar texto" e "Baixar .md".

### 2. Roteiro de teste
URL base: `.../22-perguntar-a-uma-ia/index.html?aberto=0|1&direito=0&tema=claro`; "Estado típico de outra tela" abre o diálogo de cada uma das 11 telas. Estados (nomes de captura): `tipico`, `comentarios`, `copiado`, `erro`, `extremo`, `extremo2`, `falhou`, `fechado`, `leitura`, `mapa`, `nm`, `privado`, `vazio`, `zero`, `carregando`.
1. `estado=tipico`: olhar frase, barra e as quatro linhas. Pergunta: em 3 segundos, o que vai sair, se cabe e o que ficou de fora?
2. `estado=extremo` (canais 262.400 caracteres; 232.400 fora da cópia: 190.000 e 42.400 na lista, 170.000 "só no arquivo completo" e 62.400 "não saem" na legenda): quatro números para o mesmo 232.400. Pergunta: confunde (M2)?
3. `nm` (não medido), `zero` (zero medido), `vazio` (tela sem número, "Copiar texto" continua ligado com a primeira linha de aviso), `erro`, `carregando`: cada um diz o que falta?
4. `privado` (com o direito "ver desempenho privado": pastilha laranja "inclui dado privado do canal" e linha verde "incluído") × `leitura` / `direito=0`. Pergunta: laranja ("é do seu canal") e verde ("entrou") convivem bem ou confundem?
5. `comentarios`: texto de terceiros com o prefixo `│ `, nunca cerca de código; a linha "texto de comentários" muda de estado.
6. Copiar: clicar "Copiar texto" → `copiado` (faixa verde, o diálogo fica aberto, o contador da pergunta); forçar falha → `falhou` (o botão "Selecionar o texto da prévia" aparece como segunda saída; "Baixar .md" gera arquivo de exemplo). Pergunta: o "Copiado" é confiável e visível?
7. Pergunta no campo: o resumo, a barra, as linhas e a prévia se recalculam; a pergunta entra no total e nunca é cortada.
8. Teclado: foco inicial no título; Tab não escapa (40 Tab seguidos); Esc fecha e devolve o foco ao botão; Esc com ⓘ aberto fecha primeiro o ⓘ.
9. `mapa`: o mapa das 11 posições do botão é esquemático (só Comparar tem a tela de trás desenhada; Vídeo e Vídeo próprio a 390 px não foram desenhados). Pergunta: a faixa de topo, ponta direita, acima do título, serve em todas?
10. A 1440x900 o rodapé do miolo corta a última linha nos estados com faixa extra (M1); a 390 vira folha de tela cheia (a 390 x 844 o miolo rola dentro da folha).
11. Celular 390 px; tema claro e escuro; Opera (o `<dialog>` e o `navigator.clipboard`, que precisa de contexto seguro e gesto do usuário).

### 3. Decisões pedidas ao dono (NOTAS seção 3)
1. Onde fica o botão? Padrão: faixa de topo, ponta direita (acrescenta ~40 px nas telas raiz). Alternativas: botão flutuante, ou dentro do grupo de ações do cabeçalho.
2. A prévia mostra início e fim com o meio dobrado (adotado) ou o texto inteiro rolando? O botão "Baixar .md" é como ele lê tudo.
3. Foco inicial no título (adotado) ou no campo "Minha pergunta"?
4. Fica aberto depois de "Copiado" (adotado) ou fecha sozinho?
5. "Selecionar o texto da prévia" como segunda saída quando falha o copiar (adotado, não está no spec).
6. Teto de 1.000 caracteres na pergunta, que entra no total (adotado; o spec não fixa).
7. Tela sem número (vazio): "Copiar texto" continua ligado. Alternativa: desligar.
8. Dado privado no pacote de quem tem o direito: só a pastilha e a linha verde (adotado). Alternativa: segundo aviso em âmbar.
9. Nome do botão "Perguntar a uma IA" (o do spec); ícone de balão com um sinal de mais.
Respostas do dono: não registradas.

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r2)
M1: a 1440x900, nos estados com faixa extra, o rodapé do miolo corta a última linha (16 a 66 px de rolagem interna; "34 de 1.000 caracteres" cortado em `copiado`). M2: em "Canais (262.400)", dois desdobramentos do mesmo 232.400 convivem; acrescentar um total em mono ("soma 232.400") ou rotular as listas. M3: mantidas como pergunta ao dono: o mapa esquemático, a pastilha laranja com a linha verde, e `--lado-n` servindo de "medido". Estado: M1 e M2 abertas; M3 como perguntas.

### 5. O que ninguém conferiu
Contraste em número (conferido a olho nos dois temas), leitor de tela, Safari, Firefox e Opera, ordem de Tab completa na tela de trás, o texto real das 11 telas (o do mockup é de exemplo e abreviado), o clique de "Baixar" (gera arquivo de exemplo), teclado virtual de celular abrindo sobre a folha, `navigator.clipboard` real, janela em celular de verdade. Cruzamentos extras só para o típico e o só leitura.

### 6. Retorno do dono e do uso real
13/10/2026: aprovado, "gostei bastante", nove padrões aceitos; reforçou que as oportunidades de melhoria de cada mockup continuem anotadas aqui. (a preencher conforme o uso)

**Para o implementador:** um componente só para botão e diálogo nas 11 telas (o teste do item 159 percorre a lista de telas; ritmo por hora entra "quando existir"); pacote montado no servidor, conferência de sessão, site e direito refeita na ação; o servidor devolve `texto`, `totalCaracteres`, `caracteresCopia` (30.000), `caracteresCompleto` (200.000), `caracteresQueNaoSaem`, `tabelas`, `medidos / zerosMedidos / naoMedidos`, `privado`, `comentarios`, `corte`, `primeiraLinhaAviso`; ordem do corte: números dia a dia, linhas além das primeiras de cada lista, nunca definições e avisos; classe de dado (i) em cache, classe (ii) fora do cache; auditoria com origem `botao`; os números do exemplo (12.400, 262.400, 232.400) são de exemplo.

---

## 3b. Vídeo próprio: faixas "em teste A/B" e "antes do início do registro"

Estado: em ajuste, o roteiro pode mudar. Última revisão (r6): 1 bloqueio (B1: em `zero`, "Depois: 6 dias (10/10 a 16/10)" são 7 dias de calendário e a tela não diz qual falta) e 2 "corrige" (C1: o ⓘ do gráfico de impressões diz "números escritos sob as barras", mas a 390 o `extremo` não escreve número; C2: `shots/` com 4 arquivos de lixo e NOTAS apontando recortes que não existem). Pasta: `3b-video-proprio-faixas-ab-e-registro/`.

### 1. O que a tela responde
"Esta capa ou este título que troquei funcionou, e o que esteve no ar?" Linha "Trocas deste vídeo: ..." logo abaixo dos botões; no gráfico, colchete cheio com dentes para teste A/B e colchete pontilhado com linha vertical em 07/10 para "antes do início do registro"; régua das versões (linha do tempo de 07/10 até hoje); lista com três tipos de linha (faixa reconstruída, teste A/B, troca numerada) e comparação antes × depois com intervalo de taxa.

### 2. Roteiro de teste
URL base: `.../3b-video-proprio-faixas-ab-e-registro/index.html?caso=<caso>&tema=claro&novo=nao`. Casos: `tipico`, `extremo`, `hoje`, `zero`, `semnumero`, `so-teste`, `so-reconstruido`, `vazio`, `erro`, `leitura`. `tipico`, `extremo` e `leitura` mostram um mês de registro (17/11); os demais usam 13/10.
1. `caso=hoje` (13/10; registro de 6 dias): olhar a linha "Trocas deste vídeo", o colchete pontilhado em 07/10 e os três dias não medidos (hachura rosa); a troca 2 mostra "13/10 chega em 15/10, completa em 21/10". Pergunta: em 3 segundos, a capa ou título funcionou? Gráfico sem marca antes de 07/10 não quer dizer sem troca: a tela deixa isso claro?
2. `caso=tipico` (17/11; 12 trocas no exemplo da aba; 2 testes): colchete de teste com dentes dos ciclos, régua das versões, troca 1 (03/11) e 2 (09/11) com taxa e intervalo; faixas se cruzam = "sem diferença firme". Pergunta: ▲ "taxa subiu" é lido sem cor (verde só em ▲)?
3. `caso=extremo` (6 trocas, 2 testes; 4 das 6 caem em "sem dias para comparar", porque todo vencedor e todo restauro têm teste vizinho). Pergunta: é frustrante que o caso mais comum de quem usa o A/B Lab não tenha comparação? A causa está dita na tela ("antes disto o vídeo estava em teste A/B")?
4. `caso=zero` (20/10): "Depois: 6 dias (10/10 a 16/10)" (B1 em ajuste) e a caixa vazada com 0 (zero medido) contra a hachura (não medido).
5. `caso=semnumero`: três chips sem número, cada um com o motivo ("sem antes: publicado em 06/10, 2 dias antes da troca"). Os quatro estados sem número têm bordas distintas: hachura rosa (o dado vai chegar), pontilhado (não existe), contorno cheio com barra grossa no lado cortado (sem dias para comparar), tracejado (poucas impressões). Pergunta: distinguem-se em cinza?
6. `caso=so-teste` (colchete aberto "em andamento", sem "Ver antes e depois"), `caso=so-reconstruido` (faixa com moldura pontilhada, losango pontilhado, selos "sem antes e depois" e "a thumbnail original não dá para recuperar").
7. `caso=vazio` ("0 trocas" na caixa vazada), `caso=erro` (pastilha "até quando as trocas estão certas e quando o sistema tenta de novo"), `caso=leitura` (impressões, cliques e taxa viram caixa com cadeado; link vira "sem acesso ao A/B Lab").
8. `&novo=nao` esconde as marcas "+ novo": a tela sem o acréscimo.
9. Leitura por dia do gráfico (botões "Dia anterior" e "Dia seguinte", setas): a fala do dia diz ciclo de teste e "antes do início do registro". Falta dizer o dia da publicação (S3).
10. Celular 390 px (linha das trocas começa em y 905 a 975, logo abaixo da dobra; números dos 35 dias escritos sob as barras no `tipico`, mas não no `extremo`); tema claro e escuro; Opera.

### 3. Decisões pedidas ao dono (NOTAS seção 3)
0. Novas da r1: (a) 4 das 6 trocas do `extremo` caem em "sem dias para comparar" (ver dúvida 2); (b) a régua das versões não foi pedida (120 px); se achar demais, corta-se; (c) só leitura: dado do teste (datas, ciclos, "vencedor aplicado em 03/11") continua visível e só o link some; decidir se é público do canal.
1. O gráfico mostra a faixa "antes do início do registro" mesmo sem versão reconstruída ali? Padrão: sim, colchete pontilhado e linha em 07/10 sempre que o gráfico começa antes dessa data; some quando a janela de 35 dias passa de 07/10.
2. A troca "vencedor" ou "restauro" compara com o quê? Padrão: segue o spec (7.5.5), a janela para na troca vizinha de qualquer campo, então o antes cai em "sem dias". Alternativa: comparar com os dias anteriores ao teste (muda a regra do spec).
3. Troca com origem "não sabida": numerada, sem comparação. Alternativa: comparar e avisar.
4. Mostrar a falha da leitura também no gráfico e na régua? Hoje só no bloco.
5. Limiar de 100 impressões e janela de 7 dias: à espera da decisão (pergunta 27 do spec). Em `hoje`, com 158 impressões em 30 dias, toda troca dá "ainda não dá para dizer".
6. A frase fixa do ⓘ (item 35 pede "cálculo do Observatório sobre dados públicos do YouTube"; impressões e cliques não são públicos, então o texto cita "dados do YouTube Analytics do seu canal").
7. (r4/S1) Views e cliques: nos exemplos o gráfico de views soma ~11 vezes os cliques (1.477 views e 131 cliques em `tipico`). Padrão: manter. Alternativa: views do dia saírem dos cliques do dia (views = cliques x 1,3 a 2,5).
Respostas do dono: não registradas.

### 4. Melhorias que o revisor sugeriu e não bloqueiam (r6)
S1: views contra cliques de novo (`extremo`: a taxa vai de 2,8% a 7,5% e as views por dia ficam entre 1.164 e 1.996 antes e depois). S2: miniatura do cabeçalho não é a do "depois" da última troca de thumbnail (herança do mockup 3 aprovado). S3: a fala do dia 06/10 não diz "Dia da publicação do vídeo". S4: barra "158 impressões em 30 dias" contra "30 impressões em 29 dias"; escrever "158 nos dois canais em 30 dias; neste vídeo, 30 em 29 dias". S5: a 390 a pergunta cai logo abaixo da dobra (miniatura de 200 px do cabeçalho aprovado). S6: "Um mês depois do início do registro (hoje, 17/11)" são 41 dias; "mais de um mês". S7: chip "seu canal" em `leitura` (para quem só lê, "o canal que você acompanha"; pergunta de produto). Estado: abertas.

### 5. O que ninguém conferiu
Leitor de tela (rótulos, `role` e `aria-live` por dia conferidos, não a fala), Safari, Opera, Firefox; contraste dos elementos gráficos não medido de novo (CSS inalterado desde a r3); movimento reduzido, zoom de 200% e fonte maior do sistema; mouse real sobre o gráfico; 360 px; ordem de foco por Tab no conjunto. Dado real: tudo é exemplo inventado. Mudança em arquivo copiado: `a4-comum.js` (cópia do lote 1) ganhou `cfg.faixas` e `cfg.nvTag` em `A.serieDia`.

### 6. Retorno do dono e do uso real
Sem registro de aprovação. (a preencher conforme o uso)

**Para o implementador:** `A.serieDia` ganha `faixas: [{ k: 'ab', ... }, { k: 'reg', ... }]`; `ab` vem das tabelas do A/B Lab (início, fim ou parada, data de cada ciclo), `reg` é derivado do último dia antes do início do registro; 07/10/2026 é a data do início do registro (confirmar com o dado real); leitura da troca: lado antes = até 7 dias terminando 2 dias antes da troca, depois = até 7 dias começando no dia seguinte, param na troca vizinha de qualquer origem; limiar de 100 impressões e janela de 7 dias aguardam decisão; datas de exemplo 13/10 e 17/11 e os números (1.477 views, 131 cliques etc.) são inventados; só contam como troca as de origem `fora_do_sistema`, `vencedor` e `restauro`.

---

## M4a. Diálogo "Remover canal" com a linha do arquivo (fase de manutenção)

Estado: **aprovado pelo dono em 14/10/2026** (acordo de Logan e Naksu na rodada 3). Pasta: `2026-10-14-manutencao-nas/remover-canal/` (`NOTAS.md`; plano em `2026-10-14-manutencao-nas/PLANO-DAS-TELAS.md`).

### 1. O que a tela responde
"Se eu remover este canal, o que se perde, o que não volta e o que ainda falta fazer no arquivo?" A lista de perdas ganha a linha "meses no arquivo"; o aviso depois do clique diz o prazo de 30 dias para apagar o arquivo.

### 2. Roteiro de teste
Abrir no Opera: `http://127.0.0.1:47701/2026-10-14-manutencao-nas/remover-canal/index.html?e=d3` (barra "Estados do mockup" fechada; `&barra=aberta` a abre; `&tema=claro`). Um item de cada vez:
1. `e=d3` a 390 px, claro: o botão e "Cancelar" ficam à vista sem rolar; "Não dá para desfazer" vem antes de "O que acontece:"; a lista lê-se de relance.
2. Alternar Comando e Bloco na barra: a frase muda e nunca promete data que não existe.
3. `e=d4a`: o botão fica tracejado (desabilitado) até o nome bater; testar sem acento, sem o emoji, com maiúscula, colando; repetir com `nome=longo` (100 caracteres: o título corta em 3 linhas e o nome inteiro está na caixa).
4. `e=d5`: sem botão de confirmar; "Tentar de novo" mostra "Lendo o arquivo..."; nada diz "0 meses" nem "0".
5. `e=d7` como administra e como só edita (`quem=ed`, `dt=depois`, `n=2`); `e=d9` (conexão caiu, "Recarregar a lista").
6. `e=d6&cap=ss&casa=fora`: a frase da casa fora aparece antes do clique.
7. Clicar em "Remover..." em D1, D2 e D3: o retorno muda (R1, R2, R3); em R3 `cap=ss` o aviso não some sozinho, diz "até 13/11 (30 dias)" e tem "Ver os comandos" ao lado de "Entendi" (o botão não navega no mockup). A 390 px os dois botões cabem lado a lado e têm 44 px.
8. Tab, Shift+Tab, Esc (fecha) e o foco inicial em "Cancelar".
9. Tema claro e escuro; 390 e 1440 px.

### 3. Decisões pedidas ao dono (NOTAS "Em aberto")
1. Quais contagens têm parcela só no arquivo (versões e dias de registros): do Phil.
2. Aviso persistente (toast, o desenhado) ou faixa fixa no topo da tela (proposta do Logan) para o caso Sim|Sim.
3. A régua de quatro etapas em miniatura sob "O que acontece" (sugestão do Logan, não desenhada): vale?
Respostas do dono: não registradas.

### 4. Melhorias que os revisores sugeriram e não bloqueiam
Logan S7: o D4 a 390 px abre rolado até o campo, sem aviso de que há conteúdo acima (sombra no topo do corpo); S6 do 18-v2 (palavra "lido") para o próximo lote. Naksu: a 390x667 a rolagem automática esconde o título e a lista de perdas acima do campo.

### 5. O que ninguém conferiu
Opera real, leitor de tela (o `title` do título do D4), aparelho real, rede lenta. Números (14 meses, 31.402 registros, 9 imagens, datas) são exemplo. O destino de "Ver os comandos" (bloco Canais removidos da página do Arquivo) não foi desenhado.

### 6. Retorno do dono e do uso real
**APROVADO pelo dono em 14/10/2026**, no Opera, sem pedido de mudança. Confirmou junto: aviso persistente com "Entendi" (não faixa no topo) e a régua de quatro etapas fica para quando o comando de limpeza existir.

---

## 18-v2. Aviso do banco, versão da fase de manutenção

Estado: **aprovado pelo dono em 14/10/2026** (acordo de Logan e Naksu, rodada 3); o 18 aprovado não é tocado. Pasta: `2026-10-13-a5-lote-2/18-aviso-banco-limite/` (`18-v2.html`, `NOTAS-18-v2.md`).

### 1. O que a tela responde
"Quando o banco aperta, e quando o espaço volta?" A cor passa a ser a do mais alto que o banco chega antes da próxima saída; a régua mostra o aperto e a saída do próximo mês; há linha da cópia para o NAS e para o B2.

### 2. Roteiro de teste
Abrir no Opera: `http://127.0.0.1:47701/2026-10-13-a5-lote-2/18-aviso-banco-limite/18-v2.html?caso=<estado>&tema=claro` (estados também pela barra). Um por vez:
1. `caso=v1` ao lado do `index.html?caso=verde` do 18 aprovado: nada mudou no estado calmo.
2. `caso=v2` (66% hoje): pastilha âmbar, sem a palavra "pico"; a frase "chega a 78% antes da próxima saída" fica em duas linhas a 390 px.
3. `caso=v4`: de longe, o losango vem antes do traço; a faixa âmbar a vermelho aparece; a 390 px o traço não corta o rótulo "90 dias" (também em `v2` e `v6`).
4. `caso=v5`: "O que libera espaço" sem nenhuma linha de plano pago.
5. `caso=v6`: o número cai, a cor não fica verde.
6. `caso=v8` a 390 px: "O que fazer:" é uma lista de três itens, não parágrafo; `v8a`, `v8b`, `v8c` mudam a primeira frase.
7. `caso=v0`, `v1a` e `v1n`: a linha da cópia nunca mostra "visto" sem dado (antes da 1ª cópia, atrasada, não medida).
8. `caso=v9` e `v10`: Exportações e séries aparecem como "não medido", nunca "0 exportações".
9. `caso=v11` e `v12` (12, 34 e 64 dias), `v12n`: chips ao lado da pastilha; a forma (caixa, triângulo, octógono) diz a gravidade.
10. "Abrir o Arquivo" no tema claro sobre âmbar e vermelho: legível. Celular 390 px, claro e escuro.

### 3. Decisões pedidas ao dono
As alavancas de reserva do V5 (6%, 11%, 3% por canal) são exemplo; o texto real vem da seção 8.4 do spec 01. Respostas do dono: não registradas.

### 4. Melhorias que os revisores sugeriram e não bloqueiam
Logan S6: "não foi lido por inteiro" e "Volta quando o banco puder ser lido." (V10) trocam por "não respondeu por inteiro" e "Volta quando o banco responder." no próximo lote. V5: com o losango em "já passou" o traço quase cola em "hoje".

### 5. O que ninguém conferiu
Opera real, leitor de tela, aparelho real, rede lenta; a tabela de coerência por estado (`window.BL`) não foi refeita; V1a, V1b, V2, V4, V5, V6 na revisão do Logan não foram reabertos. Dado real: tudo exemplo.

### 6. Retorno do dono e do uso real
**APROVADO pelo dono em 14/10/2026**, no Opera, sem pedido de mudança.

---

## 19. O que muda quando um mês sai do banco (casca e tabela de sincronia)

Estado: **desenhado em 14/10/2026; revisão 19-1 de Logan e Naksu aplicada e conferida pelos dois em 14/10/2026, com acordo (`CONFERENCIA-*-19-1.md`); o índice é mapa de revisor (o dono não o aprova); as peças 1, 2 e 3 foram aprovadas pelo dono em 14/10/2026 (seções 19a a 19c)**; todo número de mês arquivado é exemplo. Pasta: `2026-10-14-manutencao-nas/19-mes-fora-do-banco/` (`NOTAS.md`; plano em `2026-10-14-manutencao-nas/PLANO-DAS-TELAS.md`).

### 1. O que a tela responde
"Quais telas aprovadas mudam quando um mês sai do banco, onde está o desenho de cada uma e o que ainda falta?"

### 2. Roteiro de teste
Abrir no Opera: `http://127.0.0.1:47701/2026-10-14-manutencao-nas/19-mes-fora-do-banco/index.html` (barra "Estados do mockup" fechada; `&barra=aberta` a abre; `&tema=claro`; `&cinza=1`). Um item de cada vez:
1. Abrir `index.html` a 390 px (claro): a tabela de sincronia vira cartões, sem rolagem lateral, com os links de 44 px.
2. Conferir a tabela contra `APROVACOES-DO-DONO.md`: 13, 15 e 20 aprovados em 13/10; o 21 segurado; o 18 sem quadro de diálogo (a remoção mora na tela Canais).
3. Abrir e fechar "Como ler as formas": nove formas e as duas origens da conferência com o mesmo visto, sem cor própria; a prova a 16 px separa pontilhado, meio-círculo e caixa de arquivo.
4. Escolher dois estados do índice e abrir o quadro pelo link; a coluna "carregando" diz servidor ou requisição.
5. Ler a nota do vocabulário: "snapshot do NAS" e "lido em dd/mm" permitidos só nessas expressões.

### 3. Decisões pedidas ao dono
1. Aprovar a ordem de entrega: peças 1, 2 e 3 agora; 4, 6, 7 e 8 depois.
2. A linha do 18 na tabela diz "sem quadro": confirmar.
Respostas do dono: não registradas.

### 4. Melhorias que os revisores sugeriram e não bloqueiam
Revisão 19-1 (Logan: D-1 a D-5, S1 a S3, A1 a A8; Naksu: S1, A1 a A4, I1) **aplicada** em 14/10/2026: ver `19-mes-fora-do-banco/NOTAS.md`, seção "Revisão 19-1". Para testar no Opera: P1-10 a 390 px sem texto cortado; P1-2 com valores crescentes; `arquivo.html?perfil=ed` (frase única "esperam quem administra o site"); "Ver o comando" na linha de novembro de 2027; "Ver o que sairia" na linha "Pode sair"; `caso=hoje` ("Um mês já pode sair" só no caso cheio; o caso hoje fala em 01/05/2027). Para o spec 04 no fecho: trocar L241 ("cole … os comandos que ele imprimir") por "rode o arquivo que ele gravar" (regra do dono de 14/10), e "ⓘ de Fechado" pelo texto novo; a causa dos 28 dias nas séries fica a confirmar com o Phil.

### 5. O que ninguém conferiu
Opera real, aparelho real. As linhas "peça 8: ainda não desenhada" são promessa, não tela.

### 6. Retorno do dono e do uso real
Não registrado: ainda não foi ao dono.

---
## 19a. Peça 1: "desde dd/mm" e "no arquivo" nas telas de gráfico

Estado: **desenhado em 14/10/2026; revisão 19-1 de Logan e Naksu aplicada e conferida pelos dois em 14/10/2026, com acordo (`CONFERENCIA-*-19-1.md`); **aprovado pelo dono no Opera em 14/10/2026, com duas mudanças**. Pasta: `2026-10-14-manutencao-nas/19-mes-fora-do-banco/` (`NOTAS.md`; plano em `2026-10-14-manutencao-nas/PLANO-DAS-TELAS.md`).

### 1. O que a tela responde
"Este número está completo, ou falta um pedaço que saiu do banco?" A resposta vem junto do número ("desde 01/10/2027") e no eixo (trecho "no arquivo").

### 2. Roteiro de teste
Abrir no Opera: `http://127.0.0.1:47701/2026-10-14-manutencao-nas/19-mes-fora-do-banco/series.html` (barra "Estados do mockup" fechada; `&barra=aberta` a abre; `&tema=claro`; `&cinza=1`). Um item de cada vez:
1. `series.html` (todos os 13 quadros): no P1-4, de longe e com `&cinza=1`, distinguir as três ausências: hachura rosa (não medido, P1-11), pontilhado (antes da coleta, P1-10) e o trecho de fundo apagado com caixa e rótulo (no arquivo).
2. `?e=p1-2`: só 1, 7 e 30 dias com número; 2, 3, 5, 14 e 21 dias com "no arquivo desde dd/mm" e a data do mês de cada uma; nenhum número inventado.
3. `?e=p1-3` como administra e como edita (`&perfil=ed`): o ⓘ só aparece para quem administra; nenhuma data limite para trazer de volta.
4. `?e=p1-5`: as 72 horas viram a frase, sem curva e sem hachura; o resumo diz "não dá para calcular sem as horas".
5. `?e=p1-6`: "Calculado com 38 vídeos; 7 estão no arquivo" e, abaixo de 3, o não medido com o motivo.
6. `?e=p1-7`: apertar 3, 6 e 12 meses; só o de 12 fala do arquivo; com `&caso=hoje` o motivo é coleta recente, sem arquivo.
7. `&perfil=le`: "Ver antigo" some e fica "No arquivo desde 08/2027."; o "Ver antigo" leva ao pedido (peça 6, ainda não desenhado: o botão só avisa).
8. `&caso=hoje`: os estados que dependem de uma saída dizem que não existem ainda; nada aparece como zero.
9. 390 e 1440 px, claro e escuro.

### 3. Decisões pedidas ao dono
1. O quadro "Aprovado hoje" é reconstruído pela frontend-design (números no lugar do "no arquivo"): confirmar que representa o que o 13 e o 15 mostram.
2. As telas 14, 17a e 17c ficaram sem quadro, a confirmar pela janela de 180 dias.
Respostas do dono (14/10/2026): aprovou a peça 1 vendo o P1-4, com duas mudanças propostas pelo controlador e aceitas: (1) a caixa diz o trecho, não "desde": "25/08 a 30/09/2027 no arquivo" no lugar de "no arquivo desde 08/2027" (muda frase fixada do spec 04: vai ao fecho); (2) um caminho só para o trecho guardado: fica "Ver antigo", sai "Ver o que está no arquivo" ao lado. As duas entram na implementação (M5), sem redesenho do mockup.

### 4. Melhorias que os revisores sugeriram e não bloqueiam
Ainda sem revisão de Logan e Naksu sobre o desenho (só sobre o plano). Quando voltarem, entram aqui.

### 5. O que ninguém conferiu
O mockup 21 está segurado; a janela de 6 e 12 meses é de exemplo. Leitor de tela, Opera, aparelho real. O desenho não foi aberto dentro das telas reais do 13 e do 15.

### 6. Retorno do dono e do uso real
14/10/2026: aprovado vendo um quadro só (P1-4, `series.html?e=p1-4`), com a explicação "hoje à esquerda, depois da fase à direita". Selos, "04 L77", a nota cinza e a faixa "Exemplo" são anotação de revisor e não vão ao site.

---
## 19b. Peça 2: a página do Arquivo

Estado: **desenhado em 14/10/2026; revisão 19-1 de Logan e Naksu aplicada e conferida pelos dois em 14/10/2026, com acordo (`CONFERENCIA-*-19-1.md`); **aprovado pelo dono no Opera em 14/10/2026**. Pasta: `2026-10-14-manutencao-nas/19-mes-fora-do-banco/` (`NOTAS.md`; plano em `2026-10-14-manutencao-nas/PLANO-DAS-TELAS.md`).

### 1. O que a tela responde
"Algum mês precisa de mim agora, e quando o próximo pode sair?" A linha que precisa do dono sobe ao topo do tipo e é a única com contorno de cor; o que está bem recua.

### 2. Roteiro de teste
Abrir no Opera: `http://127.0.0.1:47701/2026-10-14-manutencao-nas/19-mes-fora-do-banco/arquivo.html` (barra "Estados do mockup" fechada; `&barra=aberta` a abre; `&tema=claro`; `&cinza=1`). Um item de cada vez:
1. `arquivo.html` (caso cheio): sem ler, apontar qual mês precisa de você (Novembro de 2027, a única com contorno âmbar e triângulo, no topo de Views por dia).
2. Repetir com `&cinza=1`: a linha de problema continua à frente.
3. Abrir "2027: 8 meses no arquivo" e fechar; abrir "Como ler as formas".
4. Ler a régua de um mês saudável (Dezembro de 2027) e a de um com "conferido por você (vale até 25/05/2028)" (Novembro): o visto da origem não tem cor própria.
5. Setembro de 2027 (já saiu das telas) vem logo depois da linha de problema, com "Liberar o espaço devolve cerca de 4% do banco", e o botão "Liberar o espaço (disponível em 09/05/2028)" tracejado diz a data.
6. `?e=todos-meses` e `?e=todos-problemas`: um quadro por estado; conferir que nenhuma frase traz só cor (sempre forma e texto) e que "A casa não respondeu" é triângulo até 36 h e octógono depois (PC1, PC2).
7. `?e=todos-canais`: zero medido ("Nenhum canal removido pede limpeza.", caixa com o 0), não medido (hachura), "Já limpos (N)", a quarta etapa nunca em visto; com `&cmd=nao` a frase-resumo e a ação mudam.
8. `?e=todos-teste` como administra: a faixa "Dado de teste", a marca "teste" e o botão "Encerrar o dado de teste"; como edita (`&perfil=ed`) ou só lê (`&perfil=le`) o grupo não aparece, e no só leitura a página some.
9. `&caso=hoje` e `&caso=magro`: nada como zero solto ("Nenhum mês no arquivo ainda" na caixa de zero medido).
10. 390 px: a régua de cinco etapas fica em uma linha, "Recuperação" vira "Teste", sem rolagem lateral; claro e escuro.

### 3. Decisões pedidas ao dono
1. O espaço "+ novo" do interruptor do automático (peça 4) e de "Vídeos antigos" (peça 8): aceitável enquanto não são desenhados?
2. O ⓘ de "Fechado. Cópia a partir de dd/mm" é texto novo (o spec não o dá): aprovar a frase.
3. A frase "Cole na forja os comandos que ele imprimir, um por vez" muda uma palavra do spec ("linhas" é proibida): confirmar.
Respostas do dono (14/10/2026): aprovou a página inteira no caso cheio (`arquivo.html`), sem responder às três decisões uma a uma. A 3 já está decidida pela regra do dono de 14/10 ("rode o arquivo que ele gravar", nada para colar), que vale no fecho do spec 04.

### 4. Melhorias que os revisores sugeriram e não bloqueiam
Ainda sem revisão de Logan e Naksu sobre o desenho (só sobre o plano). Quando voltarem, entram aqui.

### 5. O que ninguém conferiu
Opera real, leitor de tela, aparelho real, filtro de cinza do macOS. O contraste da hachura foi medido sobre o fundo plano. Todos os números de meses arquivados são exemplo.

### 6. Retorno do dono e do uso real
14/10/2026: o índice do mockup 19 (`index.html`) não fez sentido para o dono ("Não estou entendendo nada deste mock up"): é um mapa de revisor, não uma tela. Com a explicação em três linhas (frase do topo, um cartão por tipo de dado, o caminho de cada mês), a página do Arquivo foi aprovada. Lição: mostrar ao dono a tela, não o índice, e abrir no caso que tem conteúdo.

---
## 19c. Peça 3: tirar o mês do banco

Estado: **desenhado em 14/10/2026; revisão 19-1 de Logan e Naksu aplicada e conferida pelos dois em 14/10/2026, com acordo (`CONFERENCIA-*-19-1.md`); **aprovado pelo dono no Opera em 14/10/2026**. Pasta: `2026-10-14-manutencao-nas/19-mes-fora-do-banco/` (`NOTAS.md`; plano em `2026-10-14-manutencao-nas/PLANO-DAS-TELAS.md`).

### 1. O que a tela responde
"Posso tirar este mês? Se não, o que falta? Se sim, o que eu perco?"

### 2. Roteiro de teste
Abrir no Opera: `http://127.0.0.1:47701/2026-10-14-manutencao-nas/19-mes-fora-do-banco/arquivo.html?e=todos-tirar` (barra "Estados do mockup" fechada; `&barra=aberta` a abre; `&tema=claro`; `&cinza=1`). Um item de cada vez:
1. T1: cada condição tem símbolo e diz o que fazer; nenhum botão cinza mudo.
2. T2: "Ver o que sairia" não tira nada e diz isso; o contador "simulações vistas: 2 de 2" aparece.
3. Na página (`arquivo.html`), como administra: clicar em "Tirar fevereiro de 2028 do banco online": a janela abre com o foco em "Cancelar"; Esc fecha e o foco volta ao botão; Tab não sai da janela; confirmar troca a linha para "Saiu das telas em 03/05/2028".
4. T4, T4a, T4b: a frase da prova inteira; os dois passos dizem que não dá para remover canal nem apagar vídeo enquanto o espaço não for liberado; a quarta saída diz "Não volta ao banco por este botão".
5. T4c: o botão fica tracejado até a frase "apagar comentários de outubro de 2027" ser digitada (maiúscula ou minúscula; colar vale).
6. T7 e T7a: "Liberar o espaço" diz a data enquanto está desabilitado; depois dos 7 dias os dois botões ficam habilitados; T7b aos 14 dias é âmbar.
7. T8, T8r, T8x: o segundo passo diz que depois não volta pelo site; o repetido não é vermelho.
8. T10 a T10d: trazer de volta, com o dado que não bateu, com a proteção não instalada e a única falha, em vermelho.
9. 390 px: os botões da janela empilham com 44 px; claro e escuro.

### 3. Decisões pedidas ao dono
1. Os botões "Tirar" e "Liberar o espaço" têm o peso máximo da tela (texto invertido): é o que se quer?
2. A frase digitada do T4c foi copiada do spec; confirmar o texto.
Respostas do dono (14/10/2026): "Faz sentido": aprovou os dois passos (sai das telas, depois libera o espaço) e a janela de confirmação, testados na página do Arquivo.

### 4. Melhorias que os revisores sugeriram e não bloqueiam
Ainda sem revisão de Logan e Naksu sobre o desenho (só sobre o plano). Quando voltarem, entram aqui.

### 5. O que ninguém conferiu
Leitor de tela (ordem de anúncio do status do T4c), Opera real, aparelho real. O diálogo de "remover canal com mês fora das telas" é o D7 do `remover-canal/` (aprovado), não foi redesenhado aqui.

### 6. Retorno do dono e do uso real
14/10/2026: aprovado na página (`arquivo.html`, caso cheio), não nos 17 quadros do grupo "tirar".

---

# LOTE 1 (aprovado em 13/10/2026, decisão 62)

Fonte: `docs/superpowers/mockups/2026-10-13-a5-lote-1/` (`LEIAME.md`, `PLANO-UX.md`, `REVISAO-UX.md`, `AJUSTES-UX-2.md`). Esta pasta não separa `NOTAS.md` por tela: o `LEIAME.md` traz a ordem de abertura, o que mudou por rodada, as "tabelinhas que fecham" e a dívida declarada; o `PLANO-UX.md` traz a pergunta de 3 segundos de cada tela; a `REVISAO-UX.md` traz o veredito por tela. Faltam, por tela, uma lista própria de "dúvidas ao dono" (as duas perguntas do lote 1 foram decididas pelo dono em 12/10 e já constam no `LEIAME.md`) e a extração das sugestões da `REVISAO-UX.md` (seções A a E): não extraí aqui; consultar o arquivo se uma melhoria for reaberta. O que o dono disse ao aprovar o lote 1: não registrado nas pastas (só o número da decisão, 62).

Decisões do dono em 12/10 (já não são perguntas): B mede o que foi assistido no período, em todos os vídeos do canal; C tem "Sincronizar agora" só na linha do canal em erro (gasta uma chamada de cota por canal; fica desabilitado com a hora de volta quando a cota acabou). As outras sete perguntas da rodada 1 foram respondidas pela regra escrita: 0 dentro das casas; faixa também no "vídeo novo"; gráfico de zeros no dia 7; escolha lembrada no navegador, padrão "canal inteiro"; e-mail no 3º dia e lembrete por semana; cartão de comentários fica na fila; apagar canal inteiro reaproveita "remover canal" com o painel por cima.

Roteiro comum do lote 1: servidor na raiz dos mockups; endereço `http://127.0.0.1:47701/2026-10-13-a5-lote-1/<arquivo>.html?caso=...`. Cada tela está dentro do Observatório real; o que a proposta acrescenta leva contorno tracejado verde-água e "+ novo". Itens sempre válidos: celular 390 px, claro e escuro, Opera.

## A. Ainda cedo (`a-ainda-cedo.html`)

Estado: aprovado em 13/10/2026 (decisão 62). Revisão: "pronto para o dono" na reconferência da rodada 2.

1. **O que a tela responde:** "Esse vídeo novo está sem impressão porque ninguém viu ou porque o dado ainda não chegou?" Resposta de relance: "Ainda cedo: dia 4 de 7. Os dias que o YouTube já mandou vieram com 0; hoje e ontem ainda não chegaram." Faixa de 7 casas (a última tem a mesma data da frase; "faltam N dias" é o número de casas pontilhadas depois de hoje).
2. **Roteiro de teste:**
   1. `?caso=4d-zeros`: a data da frase é a da 7ª casa? "faltam 2 dias" bate com as casas pontilhadas? Os 0 dentro das casas são "zero medido" (caixa vazada), e hoje e ontem são "não medido: o dia ainda não chegou"?
   2. `?caso=4d-numeros` (o caso que o dono descreveu): "109 impressões e 5 cliques estimados em 3 dias medidos".
   3. Os demais casos da tabelinha do `LEIAME.md` (nomes dos `?caso=` além destes dois: não registrados; usar a barra): 17 horas (faltam 5 dias, 18/10), 2 dias (faltam 4, 17/10), 3 dias com zeros (faltam 3, 16/10), 5 dias com zeros (falta 1 dia, amanhã), dia 7 com zeros ("Nenhuma impressão nos 5 dias medidos, mas o vídeo teve 598 views. O relatório de alcance do YouTube pode estar incompleto"), 8º dia com zeros e com números, e "coleta não rodou". Pergunta: os "0" parecem verdade ou falha em verde?
   4. Gráfico no dia 7 com tudo 0: só a linha do 0, sem eixo inventado e sem a faixa de cliques estimados.
   5. Celular 390 px; claro e escuro; Opera.
3. **Decisões pedidas ao dono:** 0 dentro das casas ou só "ainda cedo"? (respondido pela regra: 0 dentro). Faixa também no vídeo novo? (sim). Gráfico de zeros no 7º dia? (sim, com a frase de A2).
4. **Melhorias sugeridas, não bloqueantes:** não extraídas (ver `REVISAO-UX.md` seção A). Aplicados na rodada 2: A1 (faltam N dias bate com a faixa), A2 (frase com 0 impressão e views no cabeçalho), A3 (nome único "não medido: o dia ainda não chegou"), A4, A5. A6 parcial (ver `AJUSTES-UX-2.md`; não usou "Dia 4 de 7").
5. **O que ninguém conferiu:** leitor de tela (só `aria-label`), Safari, Opera, ordem de teclado completa (só testada no painel da E), popovers do ⓘ abertos, 640 e 1100 px (confiou nas medidas do desenhista). Dado real: tudo exemplo.
6. **Retorno do dono e do uso real:** 13/10/2026: aprovado (decisão 62). (a preencher conforme o uso)

**Para o implementador:** dias que faltam = 6 menos a idade, igual ao número de casas pontilhadas; o dia da publicação é o dia 1 e o gráfico volta no dia 7; "O YouTube entrega as impressões de cada dia 2 a 3 dias depois"; ontem e hoje são sempre "não medido".

## B. % assistido por período (`b-assistido-periodo.html`)

Estado: aprovado em 13/10/2026 (decisão 62). A reconferência da rodada 2 mandava voltar (B-R1); a rodada 3 consertou (mediana por vídeo, igual ao "canal inteiro" aprovado).

1. **O que a tela responde:** "Esse vídeo prende mais do que o canal prende agora, ou só mais do que ele prendia antes?" Resposta: "Acima do normal dos últimos 90 dias: 54% contra 51%", com três cartões (47, 51, 52; ▲ +4 e ▲ +5 contra o canal inteiro).
2. **Roteiro de teste:**
   1. `?periodo=90`, depois `?periodo=28` e o inteiro: os números da tabelinha do `LEIAME.md` aparecem exatamente (51% contra 47% = +4; 52% = +5; vídeo 54%).
   2. `?tela=canal&periodo=90`: a conta fecha em cada célula da aba (até 5 min 55%/56% contra 52%; 5 a 15 min 53%/54% contra 47%; acima de 15 min 43%/44% contra 41%).
   3. Casos "piorando" (inteiro 49, 90 dias 46 = −3, 28 dias 43 = −6) e "poucas views" (inteiro 48, 90 dias 49 = +1 ＝; 28 dias só 340 views de 1.000, sem comparar). Os nomes exatos dos `?caso=` não estão completos na pasta (aparece `?caso=pior...`); usar a barra.
   4. Escolha lembrada: trocar o período, recarregar; "Salvo neste navegador · Voltar ao padrão"; com "canal inteiro" não há lembrete.
   5. "poucas views" = hachura rosa (o dado não chegou; mínimo de 1.000 views no período). Pergunta: faz sentido ser a mesma hachura de "não medido"?
   6. Setas ▲ ▼ ＝ (até 2 pontos é ＝). Celular 390 px; claro e escuro; Opera.
3. **Decisões pedidas ao dono:** "últimos X dias" mede o que foi assistido no período em todos os vídeos (decidido 12/10). Escolha lembrada no navegador, padrão "canal inteiro" (respondido pela regra).
4. **Melhorias sugeridas, não bloqueantes:** não extraídas (ver `REVISAO-UX.md` seção B). Aplicados: B1 (normal do período), B2 (diferença sobre números arredondados), B3 (sai "o canal vem melhorando"), B4 (legenda curta), B6 (título da lista). Dívida: B5 e B7.
5. **O que ninguém conferiu:** leitor de tela, Safari, Opera, ordem de teclado completa. Dívida declarada: B5 (hachura para "poucas views") e B7 (cartões são `<a>` com `aria-current`; na implementação, `radiogroup` ou botões com `aria-pressed`).
6. **Retorno do dono e do uso real:** 13/10/2026: aprovado (decisão 62). (a preencher conforme o uso)

**Para o implementador:** a conta é a MEDIANA por vídeo do % assistido, a mesma do "canal inteiro"; os períodos só restringem o que entra à janela; não há média pesada pelas views; toda diferença em pontos é sobre os números arredondados.

## C. Canal de concorrente em erro (`c-canal-em-erro.html`)

Estado: aprovado em 13/10/2026 (decisão 62). Revisão: "pronto para o dono" na rodada 2.

1. **O que a tela responde:** "Algum canal parou de sincronizar, desde quando, por quê, e preciso fazer algo?" "1 canal em erro há 9 dias: o YouTube diz que ele não existe. Você precisa decidir." A frase diz quando avisamos por e-mail e quando é o próximo lembrete; a linha do canal em erro tem 141 px.
2. **Roteiro de teste:**
   1. `?caso=9d`: a frase ("Avisamos você por e-mail em 07/10; próximo lembrete em 14/10, depois toda semana até resolver"); o botão "Sincronizar agora" só na coluna de ações dessa linha.
   2. `?caso=tres` (escada de 3 caixas só com 2 ou mais canais em erro: "Tentando de novo", "Alarme do sistema ligado", "Avisado por e-mail").
   3. `?caso=9d&acao=cota`: botão desabilitado com a hora de volta quando a cota acabou. `acao=ok`: o canal sai do erro ("Sincronizado agora, às 14:32", contador 0, filtro "Em erro 0").
   4. Casos de 2 dias (e-mail em 14/10) e de 2 horas ("Passa sozinho" some depois de 12 h; e-mail em 16/10).
   5. Pergunta: a linha de 141 px não empurra a lista demais? Celular 390 px (cartão de 505 a 541 px); claro e escuro; Opera.
3. **Decisões pedidas ao dono:** pode haver "Sincronizar agora" só na linha do canal em erro? Decidido em 12/10: sim. Alarme: vale o e-mail no 3º dia e o lembrete por semana.
4. **Melhorias sugeridas, não bloqueantes:** não extraídas (ver `REVISAO-UX.md` seção C). Aplicadas: C1 a C8 e S4 (texto das pastilhas na cor do texto).
5. **O que ninguém conferiu:** se as rodadas "00, 06, 12 e 18 h" correspondem ao cron real; leitor de tela, Safari, Opera, ordem de teclado. Contraste dos pares novos (envelope, datas, pastilhas) foi revisto na rodada 2.
6. **Retorno do dono e do uso real:** 13/10/2026: aprovado (decisão 62). (a preencher conforme o uso)

**Para o implementador:** 3º dia = dia em que o erro começou + 3, depois uma vez por semana (Lucas Bigodinho: começou 04/10, e-mail 07/10, próximo 14/10; Paddy Doyle: 11/10, próximo 14/10); confirmar as rodadas do cron (00, 06, 12, 18 h).

## D. Atraso da leitura por hora (`d-atraso-leitura.html`)

Estado: aprovado em 13/10/2026 (decisão 62). A reconferência da rodada 2 pedia D-R1 (duas contas do mês); a rodada 3 refez os casos `atraso-leve` e `desligada`.

1. **O que a tela responde:** "A medida por hora está rodando? Perdi horas que não voltam?" "Parada há 3 horas. 3 horas sem medida; hora perdida não volta." Trilha de 24 casas (de 15:00 de ontem a 14:00 de hoje) e bloco do mês (303 horas).
2. **Roteiro de teste:**
   1. `?caso=atraso-leve` ("há 1 h 40 min", 298 de 303 com medida), `?caso=desligada` (20 horas sem medida, 279 de 303), `?caso=atraso-3h` ("Faltam as medidas de 12h, 13h e 14h. O sistema tenta de novo a cada 20 minutos; você não precisa fazer nada."), `?caso=varias` (também: "Outra tarefa atrasada: retratos de comentários, desde 11/10").
   2. Casos "em dia" (299 de 303), "parada há 14 horas" (285 de 303; acima de 6 h a frase muda e a lista abre), `sem-leitura` (sem trilha: "A primeira leitura é em 14/10, às 10:00").
   3. Conferir: as casas hachuradas são as mesmas horas do texto; a soma com medida + sem medida dá 303 em todos os casos.
   4. Pergunta: "hora perdida não volta" é claro? Celular 390 px; claro e escuro; Opera.
3. **Decisões pedidas ao dono:** nenhuma pergunta própria registrada.
4. **Melhorias sugeridas, não bloqueantes:** não extraídas (ver `REVISAO-UX.md` seção D). Aplicadas: D1 a D5 e D-R1 (conta do mês: 303 horas, não 312).
5. **O que ninguém conferiu:** dívida declarada: as casas de 11,5 px da trilha não são alvo de toque (a informação está na frase, na linha "Faltam..." e no `aria-label`; se virarem controle, o caminho é uma lista de horas). A frase "confira a tarefa na lista abaixo" (acima de 6 h) é do desenhista: confirmar o que o dono pode de fato fazer. Leitor de tela, Safari, Opera.
6. **Retorno do dono e do uso real:** 13/10/2026: aprovado (decisão 62). (a preencher conforme o uso)

**Para o implementador:** mês = 303 horas (01/10 00:00 a 13/10 14:00); "sem medida no mês" = 4 que já faltavam (valor de partida do exemplo) + horas da trilha; a leitura por hora começa em 14/10 às 10:00 neste exemplo (sem-leitura).

## E. Saíram do YouTube (`e-sairam-do-youtube.html`)

Estado: aprovado em 13/10/2026 (decisão 62). Revisão: "pronto para o dono" na rodada 2 (só sugestões). É a única tela do lote 1 que apaga.

1. **O que a tela responde:** "O que sumiu, o que eu tenho guardado disso, e o que acontece se eu apagar?" "5 itens esperando você. Nada foi apagado. Sem resposta, o dado fica." (a frase diz "5 itens esperando você e 2 apagando"; a aba conta 7.)
2. **Roteiro de teste (por último; apaga):**
   1. `?caso=cheia`: bloco "Apagando (2)" sempre à vista, bloco "Voltaram ao ar (2)" com a diferença dita, cartão curto ("Guardado: 41 dias de views, 3 títulos, ..."), "Apagado" só em "Já respondidos". Pergunta: a frase "Nada foi apagado" é verdadeira para cada bloco?
   2. `?caso=confirmar`: painel "o que some / o que fica"; botão "Apagar para sempre" só depois de digitar APAGAR (aceita minúsculas e espaços nas pontas); foco no campo ao abrir; Esc fecha e devolve o foco.
   3. `?caso=confirmar-comentarios` (7 textos, 21 contagens), `?caso=apagar-mantido` ("Apagar..." de um item mantido abre o mesmo painel), `?caso=confirmar-canal` (apagar canal inteiro reaproveita "remover canal" com o painel por cima).
   4. Pergunta: nenhum apagar existe sem painel? Celular 390 px (cartão de 570 a 608 px); claro e escuro; Opera.
3. **Decisões pedidas ao dono:** o cartão de comentários fica na fila (decisão 32 de 12/10); apagar canal inteiro reaproveita "remover canal". "5 + 2 = 7" no contador é leitura do desenhista; se o revisor queria 6, é uma linha em `e.js` (`contador`).
4. **Melhorias sugeridas, não bloqueantes:** não extraídas (ver `REVISAO-UX.md` seção E). Aplicadas: E1 a E9.
5. **O que ninguém conferiu:** dívida: sem paginação desenhada (na implementação, 10 itens por vez com "Mostrar mais N" e "Manter todos para análise", reversível); o botão realmente inerte (`<button disabled>`) é requisito da implementação; `--border-strong` mede 1,44 (escuro) e 1,77 (claro) sobre `--surface` (nenhum controle sem texto usa essa cor). Leitor de tela, Safari, Opera, ordem de teclado completa.
6. **Retorno do dono e do uso real:** 13/10/2026: aprovado (decisão 62). (a preencher conforme o uso)

**Para o implementador:** botão "Apagar para sempre" é `<button disabled>` de verdade até digitar APAGAR; a contagem de impacto já existe (`youtube_channel_removal_impact`); fila longa com paginação de 10 em 10.

---

# Perguntas transversais e decisões que valem para vários mockups

- **"＝" cinza ou âmbar (respondida por aprovação de 16, 17a e 17c):** o "＝" fica cinza com a palavra "estável"; o âmbar fica para o estado "parado" ou "em queda". Vale para 15, 16, 17a, 17c e para o `＝` da faixa do 11b. Acompanhar no uso real se o dono ainda confunde "estável" com "parado".
- **"Zero medido" × "não medido" × "ainda não existe":** caixa vazada com 0, hachura rosa, pontilhado. Nenhum revisor achou confusão, mas é a regra mais testada do dono: em cada tela, perguntar de relance se as três se distinguem (em cinza também). Pendência de vocabulário apontada nos mockups 12 (M1, M2) e 20/15: "ainda não existe" × "não medido" para causas parecidas.
- **Datas de exemplo divergentes entre mockups (para trocar pela real):** início da leitura por hora: 04/10 (12 e 13, exemplo), 11/10 (15, caso `magro`), 14/10 (21), 17/10 (17a, agora trocada para 13/10/2026, promoção do Lote 1). Início da contagem por dia: 03/10/2026 (real). Início da coleta de origem, aparelho, país e inscritos: 04/10 (12, "deploy menos 10 dias"). Início do registro do vídeo próprio: 07/10/2026 (3b). Corte da regra de contagem: 24/08/2026 (real). Fim da janela que cruza o corte: 19/10 (16, 17c). Queda sustentada possível: 14/12/2026. Leitura "mesma idade" de 30 dias: 01/04/2027.
- **Canais com 56 dias de registro (16, 17c):** conferido em produção em 13/10: 9 de 15 têm 56 dias ou mais (o mais antigo de 01/06). O caso `magro` do mockup 16 (11 canais com menos de 56 dias) é exemplo, não o real de hoje.
- **Opera e Safari:** nenhuma tela foi aberta lá. Primeira vez que o dono abrir um mockup ou tela no Opera, anotar o que renderizou diferente (hachura, listrado, pontilhado, popover do ⓘ, `subgrid` do 21).
- **Leitor de tela e toque real:** nenhum mockup foi ouvido em leitor de tela nem testado em aparelho real; é dívida do lote inteiro.
- **Casca herdada do lote 1:** vários achados ("resumo abaixo da primeira tela a 390", cabeçalho do vídeo com miniatura de 200 px, popover do ⓘ sem botão de fechar, `--border-strong` fraco, "Sincronizar agora" em duas linhas) vêm da casca aprovada, não do mockup novo. Se o dono quiser mexer, é uma decisão da casca.

---

# Pedidos novos do dono surgidos nas aprovações

1. **Tradução ou dublagem automática do YouTube (13/10/2026, ao aprovar o 16b, fora daquela tela):** o dono pediu para saber se o vídeo tem a tradução ou dublagem automática do YouTube, como dado a coletar. Registro: conferir onde a API expõe isso antes de prometer (nenhuma pasta registra o campo ou a fonte).
2. **Este documento (13/10/2026, ao aprovar o 14):** anotar o roteiro de teste e tudo o que foi capturado, de todos os mockups (anteriores e futuros), para propor melhorias conforme o retorno vier.

---

# Elementos de tela que ainda não têm mockup

Apontados pelo plano da E10 (`docs/superpowers/plans/2026-10-13-a5-e10-export-pausa-e-sinal-de-limite-plan.md`, item P8: "pedir as quatro" peças à E13; hoje pausar e despausar são comandos de linha até a tela existir):

1. **Pastilha "coleta pausada" com o botão de despausar.** Sem mockup.
2. **Passo "exportar antes" no diálogo de remover canal.** Sem mockup. (O diálogo "remover canal" com painel por cima existe no lote 1, tela E, `?caso=confirmar-canal`; o passo de exportar não está desenhado.)
3. **Seção "Sugestões"** (o item 79 do plano: canal parado há 12 meses aparece em "Sugestões"; nada acontece sem o dono; "a tela espera mockup, o item fecha no dado"). Sem mockup.
4. **Lista de lotes não confirmados:** coberta em parte pelo mockup 18 (cartão de lotes a confirmar no painel do aviso do banco); o plano a cita junto do 18.

Outros pontos sem tela, registrados nas NOTAS dos mockups: estado de carregamento do aviso do banco (18), da página do canal (15, vira esqueleto das seis células) e do Insights (17c); vídeo com menos de 72 horas no 21; tela do dono comentando no 20 (`canal_proprio`, sem cartão); raia de playlists da linha do tempo (retirada, E3); desenho de "por mês" do país no 12 (atrás de `?pais=mes`, fora da fila).


---

# Oportunidades de melhoria (alternativas descartadas que valem revisitar com o uso real)

Fonte: as alternativas escritas nas "Dúvidas para o dono" de cada NOTAS. As melhorias que o revisor deixou em aberto estão no bloco 4 de cada seção (em resumo, não com o texto integral; o texto concreto de cada sugestão está na última `REVISAO-UX-rN.md` da pasta, citada no bloco). Nos mockups em que o revisor deixou o bloco 4 só resumido, a lista completa de itens abertos está lá.

- **11b:** veredito antes do seletor (faixa sobe); nova tentativa nas janelas de 7 e 30 dias com resposta vazia; comparar "como a curva mudou" com a leitura anterior; "lida em" no lugar de "Leitura de"; forma e cor próprias para a faixa do YouTube.
- **12:** paleta própria por origem; ▲ ▼ ＝ por origem depois de 28 dias de coleta; taxa de clique por origem; subir a frase-resumo para fora do cartão; trocar "sites de fora" por forma sem azul; desenho de país por mês (atrás de `?pais=mes`) se a retroação voltar.
- **13:** quatro raias (descrição separada); linha de corte de 24/08 sempre como nota do ⓘ; voltar a "série semanal".
- **14:** nome "Muitas views, pouco sinal de que agradou"; texto obrigatório em todos os estados; só pastilha nas linhas com a leitura; chip "exemplo" em cada número; texto abaixo da lista inteira.
- **15:** abas no lugar de blocos; linha do tempo de 180 dias; lançamentos em "parte dos 30 dias"; cor própria para views de concorrente.
- **16:** esconder o chip "em queda" até 14/12; tirar o ▲ ▼ do Crescimento se confundir; regra que tire o canal parado e em queda do filtro "Em queda".
- **16b:** idioma como sexto tipo; cortar a conta de trocas na mesma data do histórico de campo; ação de linha (salvar no swipe file) para outras mudanças.
- **17a:** esconder a Diferença quando os nichos diferem; apagar os números do canal fora do ar; esconder o lado "total de hoje" até as duas leituras existirem; piso de 2 longos; "queda sustentada" só no ⓘ.
- **17b:** tirar o vídeo ao vivo da lista e só contá-lo; barra em raiz quadrada; seção recolhida para os sem medida; "múltiplo" no lugar de "multiplicador".
- **17c:** "▲ de 0" em vez de "não medido" na divisão por 0; "2º ao 4º" nos empates; escala logarítmica; cartão no topo da aba; seu canal na régua (exige acompanhar o canal do dono como concorrente).
- **18:** (em ajuste) lote pendente vira amarelo depois de 14 dias; mostrar quanto cada exportação liberaria (exige guardar bytes); aviso para quem só lê.
- **20:** matiz novo e fixo para "canal que você acompanha" e "canal grande"; dez cartões por vez; quinto motivo para o dono comentando; "Um canal que você acompanha comentou" se o nome não ficar.
- **21:** limiar de pico em 1,3x ou 2x; bloco de 3 horas calculado com as horas lidas; não mostrar data de "passa a existir" acima de 6 meses; acumulado absoluto para vídeo com menos de 72 horas; esconder o seletor de fase na tela do dono.
- **22:** botão flutuante ou dentro do grupo de ações; prévia com o texto inteiro rolando; foco inicial no campo; fechar sozinho depois de "Copiado"; desligar "Copiar texto" em tela sem número; segundo aviso em âmbar para dado privado.
- **3b:** comparar o vencedor ou restauro com os dias anteriores ao teste; comparar troca de origem não sabida e avisar; tirar a régua das versões se for demais; views do dia derivadas dos cliques do dia; marcar dias sem leitura também no gráfico e na régua.


## Atualizações depois da primeira escrita (13/10/2026, tarde)

- **12 (de onde vêm as views): aprovado pelo dono**, com os dez padrões das dúvidas aceitos: só leitura vê o total e os detalhes, sem termos nem sites; país por mês sai de vez; sem direção nem taxa de clique por origem por enquanto; a frase-resumo fica onde está no celular. Melhoria aberta do revisor (r6): o vocabulário "não medido" × "Ainda não existe" × "Não coletada" usa a mesma hachura em três nomes; unificar.
- **15 (página do canal de concorrente): aprovado pelo dono**, com os sete padrões aceitos. Melhorias abertas do revisor (r6), para o implementador: dizer no ⓘ do Acerto que a base (vídeos de 7 a 89 dias) difere da de "Views típicas" (0 a 89 dias); o limite de idade de 180 dias na linha do normal contra 179 na Direção; "n 47" vira "47 vídeos"; a 360 px a página rola 25 px para o lado; falta o estado de carregando.
- **22 (Perguntar a uma IA): aprovado**, "gostei bastante". Alternativas descartadas que vale revisitar com o uso: botão flutuante no canto inferior direito; prévia com o texto inteiro rolando; foco inicial no campo da pergunta; segundo aviso em âmbar quando o pacote leva dado privado.
- **18 (aviso de limite do banco): reprovado pelo dono, em redesenho.** O limite de 500 MB é do banco inteiro do site; a tela passa a falar em percentual do limite, sem valores; "lote" vira "exportação"; para a fase do NAS, botão ou cron que manda ao backup ao chegar a um percentual.
- **13, 20 e 3b: em nova rodada com o revisor de UX.** 13: três correções de uma linha (frase "até 14 dias" no estado semanal, nome de marca no ⓘ, contagem digitada do normal das 72 horas). 20: no estado de só leitura a resposta do criador mostra o nome que o cartão esconde. 3b: "Depois: 6 dias (10/10 a 16/10)" são 7 dias de calendário.
- **Erro de quem mostrou os mockups (controlador):** o 17c veio em branco no navegador porque o servidor estava na pasta do lote 2 e ele lê a base visual da pasta do lote 1. Servir sempre da raiz `docs/superpowers/mockups`.
- **18 (aviso de limite do banco), versão em percentual: aprovado pelo dono** em 13/10/2026, depois do redesenho. Melhorias abertas do revisor (r5): "puder ser lido" no erro (única ocorrência de "lido"); o Observatório aparece com 74% do crescimento quando a conta dá 74,6% (arredondamento); a listra clara da textura de "seu canal" tem contraste de 2,2:1 no claro e 2,6:1 no escuro; a linha do NAS está desalinhada da grade; "0 exportações" como zero medido nos estados "sem leitura hoje" e "sem medida"; a legenda de 90 dias ainda aparece em "já passou". Alternativa a revisitar com o uso: dividir o limite inteiro em "quem ocupa" (Observatório 26%, resto 17%, livre 57%) em vez de "do que está ocupado".
- **20 (comentários de destaque): aprovado pelo dono** em 13/10/2026. Ponto a confirmar com ele: o mockup desenha "o canal que você acompanha mantém o nome depois dos 28 dias", mas a decisão dele de 13/10 (pergunta 30) zera o vínculo na anulação e o banco em produção já faz isso; adotado: depois dos 28 dias o cartão vira "Um espectador". Melhorias abertas do revisor (r7): no vídeo pequeno a barra "12 de 37" conta também as respostas, e no típico "12 de 100" conta só comentários principais (decisão do engenheiro de dados); a legenda "sem resposta à vista" contra "não vimos resposta" no resto da tela.
- **3b (vídeo próprio com faixa de teste A/B e de antes do registro): aprovado pelo dono** em 13/10/2026. Melhorias abertas do revisor (r9): a 390 px a frase-resumo fica abaixo da primeira tela (causa: a miniatura de 200 px do cabeçalho do mockup 3); tabelas antigas de NOTAS.md com números que a tela já não mostra; o lado "Antes" de alguns estados começa em 01/10, antes do registro de 07/10, e só o botão de informação avisa; nenhum estado exercita erro sem troca; no `extremo` a taxa de clique fica em 6% depois que a miniatura original (2,8%) volta. Alternativa a revisitar: comparar o vencedor de um teste A/B com o período anterior ao teste inteiro, em vez de "sem dias para comparar".
- **13 (histórico do vídeo de concorrente): aprovado pelo dono** em 13/10/2026. Melhorias abertas do revisor (r10): cortar a segunda frase repetida do resumo de `saiu`; o total das 72 horas menor que "Com 3 dias" explicado só no botão de informação; a faixa de exemplo a 390 px sem "Hoje é 13/10/2026".
- **Placar do lote 2:** 14 de 15 aprovados em 13/10/2026. Falta só o 21 (ritmo por hora), segurado até a medição de 14 dias.
- **A4 (telas do canal próprio) em produção desde 13/10/2026, 16:28 (`main` = `e5cb8271`): conferida pelo dono no Opera**, logado como administrador. Viu e achou correto: a lista de Canais (o canal próprio com posição e valor, sem "—" sozinho), a página do canal (cabeçalho, "Todos os números", "Como o canal está" com impressões por dia, taxa de clique com intervalo e views por dia, abas Vídeos, Leitura e Retenção) e a comparação com o cartão "Só o seu canal mede". Conferido pelo controlador nas capturas: as 18 barras de impressões somam 158 e as de views somam 14, iguais às frases; o "% assistido" de 0% e 1% é real (diário em produção: 7 a 17 segundos de duração média em vídeos de 13 a 40 minutos). Nenhum dia hachurado apareceu porque a janela termina em 11/10, dia já entregue (a hachura só vale para dia sem linha). Ainda sem conferência: a janela de 390 px (24 cartões e "Mostrar mais 24 vídeos"), a página de um vídeo próprio, o Sentry em 24 horas e a conta só de leitura. "Vídeo novo" não se aplica: o último vídeo tem 672 dias.
- **A4, melhoria aberta (retorno do uso real, 13/10):** o cabeçalho do canal próprio diz "Entre 16 canais de Viagem" e, na mesma frase, "15º de 15 em mediana de views", enquanto o filtro da lista mostra "Viagem 14". Lido de relance parece erro. Hipótese do controlador, não conferida no código: 14 concorrentes mais os 2 canais próprios, com o segundo (sem vídeos) fora das posições por vídeo. Dizer na frase, ou no ⓘ, de onde vem cada total.

## Seção "Retenção" da página do vídeo próprio, implementada (13/10/2026, noite)

Não é mockup: é a tela implementada (E8, Tarefa 13; mockup de origem: o 6), mostrada ao dono no Opera pelo servidor local (porta 3997, semente do Gio), um estado por vez.

**O que a seção responde:** em que ponto do vídeo o público sai, e onde volta.

**Roteiro que ele seguiu, e a resposta:**

| Estado | O que testar | Resposta (13/10) |
|---|---|---|
| Curva completa | a frase "Metade das pessoas já saiu aos m:ss" se entende sem o gráfico; linha de 50% pontilhada visível; cor e marcador das maiores saídas; contorno da faixa de trecho revisto; data da coleta; recarregar sem salto de layout; janela estreita com texto legível e eixo sem sobreposição | Aprovado |
| Curva incompleta | "A curva cobre só os primeiros m:ss (N%)"; desenho para no último ponto, marcado; trecho sem dado hachurado com "sem dado depois daqui"; sem maiores saídas nem trecho revisto | Aprovado (captura no Opera: hachura, rótulo e legenda renderizam) |
| Sem curva (o YouTube respondeu "sem dado") | pastilha "não medido"; texto sem "poucas views"; nova tentativa "em 7 dias ou mais, se o vídeo tiver views novas"; data da última resposta | Aprovado |
| Não coletada ainda | "Ainda não coletamos esta curva…"; é o que todo vídeo mostra no dia em que a seção vai ao ar | Aprovado |
| Leitura falhou | "A leitura da curva falhou agora; recarregue a página."; a pastilha é a mesma "não medido" | Decisão B (decisão 75 do dono): erro e acesso negado ganham símbolo próprio, por mockup para a página inteira, depois deste release |

**Divergências do mockup 6, aprovadas junto:** cor da maior saída (deixou de reusar a do terço baixo); contorno cinza na faixa de trecho revisto; linha de 50% pontilhada e mais forte; hachura e marca na curva incompleta; 3 rótulos no eixo em celular com vídeo longo.

**Melhorias em aberto:**
- Erro e acesso negado com símbolo próprio (Naksu; decisão 75): mockup para a página inteira; rótulos com o Logan.
- A dica do ⓘ "De onde vem a curva" abre por cima da pastilha e do começo do texto (visto na captura dele do estado "não coletada"): abrir para a direita ou para baixo do título.
- "sem dado depois daqui" não diz se a falta é do YouTube ou nossa (Logan, sem bloquear).
- Sem JavaScript o gráfico não aparece, só a frase (Naksu, sugestão); a linha de 50% sobre a faixa de trecho revisto dá 2,85:1 no escuro em ~57 px (Naksu, sugestão); o comentário de `MIN_W` erra a conta do dobrável de 280 px (Naksu).
- `video/[id]` não tem `loading.tsx` e cai no esqueleto da grade de canais (Naksu).

**O que ninguém conferiu:** tema claro e 390 px no Opera pelo dono (Gio mediu em Chromium; Naksu refez por cálculo); o estado "só quem edita vê" pelo dono; leitor de tela; rede lenta real; aparelho real; a seção com dado de produção (a coleta ainda não rodou lá).

**Retorno do uso real:** (a preencher depois do release 2).

## 19d. Peça 4: o interruptor do automático

Estado: **corrigida em 14/10/2026 pela revisão 1 de Logan e Naksu (A1 a A9, C1 a C3); falta a conferência dos dois e a aprovação do dono.** Pasta: `2026-10-14-manutencao-nas/19-mes-fora-do-banco/` (`NOTAS.md`, seções "Peça 4" e "Revisão peça4-1").

### 1. O que a tela responde
"Está ligado? Vai tirar algo sem eu ver? Parou por quê? Como paro ou ligo de novo?"

### 2. Roteiro de teste
Abrir no Opera `http://127.0.0.1:47701/2026-10-14-manutencao-nas/19-mes-fora-do-banco/arquivo.html?auto=desl-2` (a peça é a caixa no alto de cada cartão); as situações com título em português estão em `interruptor.html`. Um item de cada vez:
1. Tocar no chip "automático desligou em 02/05": a página abre já no aviso; esperar 1 segundo e ver o chip sumir. Tocar em "Ver o que sairia", depois em "Ligar de novo", digitar a frase (vale sem acento) e confirmar.
2. No cartão "ligado" (`arquivo.html` sem parâmetros, cartão "Views por dia"): tocar em "Ver a regra" e ler; fechar; tocar em "Desligar" e ler o que a janela promete.
3. `interruptor.html?e=todos-parou`: em cada grupo, ver se o texto diz o que aconteceu e se dá para resolver de longe ou "pode esperar".
4. `interruptor.html?e=c8`: a validade acabou; ver que é só um aviso (círculo com "i"), sem triângulo.

### 3. Decisões do dono (14/10/2026) e o que ainda pede a ele
Já decididas, e levadas ao fecho do spec 04: há um botão "Desligar" no painel ligado (confirma sem frase, dizendo que o que já saiu continua saído); o fim dos 90 dias é aviso neutro, sem triângulo nem chip.
Ainda a confirmar: (1) depois de "Desligar", ligar de novo exige só a regra e a frase, sem simulação nova (foi você quem parou); (2) o botão "Ligar o automático…" tem o peso máximo da tela, como "Tirar o mês"; (3) o ⓘ da configuração do site manda "deixar para o Claude Code ou o Cowork".

### 4. Melhorias que os revisores sugeriram e não bloqueiam
Naksu S3 (cadeado em "ainda não dá" e "travado", só se o teste mostrar confusão com "desligado"); Logan S4 ("a cada 5 meses" sem "duas a três vezes por ano", frase do spec); Naksu S2 (cortar "(1 de 3)" da frase do "ainda não dá"; Logan aprovou o texto).

### 5. O que ninguém conferiu
Opera real, leitor de tela (anúncio do status da frase), aparelho real, o filtro de cinza do macOS.

### 6. Retorno do dono e do uso real
Ainda não testado pelo dono.
