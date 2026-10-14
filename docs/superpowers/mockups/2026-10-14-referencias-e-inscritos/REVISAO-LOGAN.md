# Revisão de fluxo e texto (Logan) - Referências e Inscritos (A5, 2ª leva E5a)

Mockup aberto em Playwright sobre `file://`, 1440 e 390 px, estados cheio, magro, vazio e tema claro. Capturas em `shots/logan-*.png` (as `logan-zoom-*` são as que provam os achados). Medi o DOM no 1440. Navegador fechado.

## Resumo
- Telas: 1 (Canais, duas seções). Veredito: **REPROVA nesta versão (volta para ajuste)**. Vira "aprova com consertos" quando B1 a B3 saírem; os C1 a C8 vão antes do dono, os S são sugestões.
- Três fricções que mais custam: (1) em 1440 a página inteira cai numa coluna de 592 px e a régua tem 10 px: a tela principal da tela não se lê; (2) "igual" e "não dá para medir" contradizem o dado mostrado (＝ ao lado de +1.800; regra de arredondamento errada), o que faz o dono ler crescimento como estabilidade; (3) a escala log tem rótulos fora de posição e some da vista na rolagem, então o número da régua se lê errado.
- Não verifiquei: leitor de tela, rede lenta real, aparelho real, tema claro em detalhe (contraste é da Naksu), a regra real de arredondamento do YouTube (ver D3).

## Pergunta, passos, veredito
- **Pergunta de quem abre:** "Quais canais do nicho mantêm as views por vídeo lá em cima, quão estável é isso, e quais ganham mais inscritos? Onde estou?"
- **Primeiro olhar (3 s):** as duas frases-resumo respondem "quem lidera" e "quantos subiram". Bom. Não respondem "onde estou" (seu canal é 7º e 5º; só se descobre rolando).
- **Passos da tarefa principal:** ver o líder = 0 cliques. Reordenar = 1 clique por seção. Ler o método = 1 clique no ⓘ. Chegar em Inscritos: em 1440 (corrigido) 1 rolagem de ~1 tela; **em 390 px são ~4 telas de rolagem** (página de 6.695 px, 844 de altura). Achar "seu canal" em cada seção: rolagem de 1 a 3 telas, sem atalho.
- **O que acerta (preservar):** frase-resumo no topo de cada bloco; régua com faixa (não nota de corte), alinhada à decisão Q5; símbolo + palavra + cor para direção (▲▼＝) e hachura para "não medido", sem zero falso; o motivo escrito na própria linha em Inscritos; chip "seu canal"; estado vazio com instrução; ⓘ com método; alvos de 44 px no celular.

## Bloqueiam (não vai ao dono)
**B1. 1440 px, Referências e Inscritos: layout quebrado.** `a4.css` define `#app` como grade de 2 colunas (menu lateral + conteúdo); o mockup não tem menu e `.ri` cai na 1ª coluna: medido `.ri` = 592 px, coluna da régua = **10,6 px** (grade `300px 10.56px 150px`). Marcadores colados no centro, faixa invisível, barra divergente de 12 px com o ▲ cortado, pílulas "não dá para medir" em coluna de 1 palavra por linha (captura `logan-zoom-nm-1440.png`). Custo: no computador a régua não diz nada e o dono vai concluir que "a faixa não funciona". Para a Naksu a quebra de layout, mas bloqueia a leitura do fluxo, por isso anoto aqui. **Solução:** em `ri.css` acrescentar `#app{display:block}` (ou remover `ch-side` do grid), reconferir 1440 e 1100. Só depois dá para julgar densidade e a régua em tela larga.

**B2. Inscritos: "＝ igual" contradiz o número ao lado.** Mochila Nômade: ＝ e **+1.800**; Janela do Fundo: ＝ e +100 (0,3%), mas Estrada de Terra −100 (−1,0%) é ▼ e Guia Nenhum +5 (+1,2%) é ▲. Terra Firme/Trilha/Fim de Linha mostram "0" em **valor medido** quando 143 mil, 19,3 mil e 2,1 mil não têm como ser exatos. Custo: o dono lê "igual" onde cresceu 1.800 e lê "0" onde só não dá para ver. Ver D2/D3 para a regra e o texto.

**B3. Inscritos: regra do arredondamento errada no ⓘ e no dado.** O ⓘ diz "acima de 100 mil mostra 3 algarismos". Pelo que sei da API (`subscriberCount` arredondado a 3 algarismos significativos, **não verifiquei hoje; Phil confirma na documentação antes do texto final**), isso vale **desde 1.000**, não desde 100 mil. O dado sintético também não respeita a regra que o mockup anuncia (1.385.000, 181.400, 603.000/601.200 têm 4 ou 7 algarismos). Custo: o texto do ⓘ ensina uma regra falsa e o dono decide em cima de variação que é ruído. Solução em D3.

## Corrigem (vai ao dono só depois)
**C1. Régua: rótulos da escala fora de posição.** `.escala` usa `space-between` (1 mil a 0%, 10 mil a 33%, 100 mil a 67%, 1 mi a 100%), mas `pos()` usa 800 a 2 mi: as marcas reais caem em 2,9% / 32% / 62% / 91%. O rótulo "1 mi" fica 9 pontos percentuais longe do ponto real e "100 mil" 5. Além disso a escala só aparece uma vez, acima da lista de 22 linhas: na linha 15 ela já saiu da vista. Custo: ler 270 mil como 300 mil, ou 1 milhão como 1,2. **Solução:** calcular a posição dos rótulos com a mesma `pos()` e desenhar 4 linhas verticais finas (1 mil, 10 mil, 100 mil, 1 mi) no fundo de cada `.reg` (gradiente ou pseudo-elementos), cinza de baixo contraste; a linha de rótulos fica `position:sticky` no topo da lista. No celular, repetir 2 rótulos pequenos (10 mil, 1 mi) sob a régua de cada linha não; basta sticky.

**C2. Texto da frase-resumo de Referências: jargão e contagem em prosa.** "a mediana mais alta é de Rota Solta: 1,2 mi views por vídeo" usa termo de estatística no topo, justo onde o dono lê de relance. E "5 têm views muito irregulares entre um vídeo e outro" é um julgamento ("irregular") sobre o canal, contra a decisão Q5 (sem selo bom/ruim). **Solução:** "Nos últimos 90 dias, o vídeo típico de **Rota Solta tem 1,2 mi de views**, o mais alto entre os 22 canais medidos. **Seu canal está em 7º (88 mil).** 5 canais variam muito de um vídeo para outro; 3 ainda sem medida." "Mediana" fica só no ⓘ e na legenda ("vídeo típico (mediana)").

**C3. Rótulos de constância "Constante / Variável / Irregular".** Palavra de qualidade para um dado que o dono pediu **sem nota de corte**; "Irregular" lê-se como defeito, e as palavras vêm de limite inventado (1,8 e 5). **Solução:** ver D1 (rótulos descritivos da faixa, não do canal).

**C4. Inscritos: "não dá para medir" mistura 3 causas e o rótulo choca com a palavra do dono.** O resumo soma 3 (novo, oculto, arredondado) e usa "não dá para medir"; Referências chama o mesmo conceito de "ainda sem mediana". O dono usa "não medido" e distingue "ainda não medido", "medido, zero" e "falhou". **Solução:** o mesmo nome nas duas seções: **"sem medida"** no resumo ("3 sem medida") e o **motivo curto na linha** (já existe, preservar): "menos de 28 dias", "contagem oculta", "dentro do arredondamento". Os 3 motivos explicados no ⓘ. Pílula com motivo curto, não `não dá para medir: contagem arredondada` repetido na linha E no texto à direita.

**C5. Estados que faltam (D5).** Erro de carga, carregando, sem acesso: nenhum existe. Sem eles, falha de uma seção aparece como "Sem canais" ou nada. Solução em D5.

**C6. Continuidade: a ordenação some ao recarregar e o foco cai.** `render()` refaz todo o HTML: depois de clicar em "Mais constante" o foco volta ao `body` (teclado perde a posição), o ⓘ aberto fecha sozinho, a ordem escolhida não sobrevive a F5 nem a voltar. Esc não fecha o ⓘ. **Solução:** guardar `ordR`/`ordI` na URL (`?ordr=cons&ordi=abs`) ou em `localStorage` com try/catch; após render, devolver foco ao botão clicado; Esc fecha o ⓘ e devolve o foco ao botão ⓘ; só alterar a lista, sem refazer as seções.

**C7. Celular: a % que é o dado principal da barra fica cortada.** 390 px: "▲ +8,0%" e "▲ +6,8" saem cortados (`overflow:hidden` com largura proporcional, mínimo de 4% de 50%). A barra usa só metade da largura. Custo: o dono lê +6 onde é +6,8. **Solução:** nunca cortar o número: colocar a % **fora** da barra, à direita dela (ou à esquerda, para ▼), em texto normal; barra só desenha o tamanho. Alvo da barra: eixo no centro, escala por maior |%| da lista.

**C8. Celular: Inscritos fica a ~4 telas abaixo e as duas listas têm 25 linhas.** Chegar ao segundo bloco custa rolagem que não carrega informação. **Solução:** no celular, controle segmentado fixo no topo "Referências | Inscritos" (um bloco por vez, o último escolhido lembrado) e cada lista mostra as 10 primeiras + a linha "seu canal" fixada + "ver os 25". Em 1440 manter as duas seções empilhadas.

## Sugestões
- S1. Frase de Inscritos acompanha a ordenação: hoje diz "o maior ganho %" mesmo quando o dono ordena por inscritos. Texto: "Em 28 dias, **Voo Rasante** cresceu mais em %: +21,8% (+2.200). **Rota Solta** ganhou mais em número: +35.000. Seu canal: +6,8% (+630)." Mostrar os dois líderes tira a dúvida de quem pediu "os que mais crescem" (decisão 73) sem clique; canal pequeno (980 inscritos) puxa o 1º lugar em % e Rota Solta fica em 12º, o que o dono precisa ver de saída.
- S2. A barra de Inscritos tem comprimento por % mesmo quando a lista ordena por inscritos; barra e ordem deixam de combinar. Fazer o comprimento seguir o critério escolhido e mostrar o outro em texto.
- S3. Referências: canal "poucos vídeos" sai da ordem e vai para o fim; dizer na legenda ("fora da ordem: poucos vídeos").
- S4. Dica ao Phil (dado, não UX): view de hoje de vídeo publicado há 3 dias puxa a mediana do canal que posta muito para baixo; o ⓘ deve dizer se vídeos com menos de 7 dias entram. Se entram, é uma frase honesta no método.
- Para a Naksu (uma linha cada): `.escala`/`pos()` descoladas; `overflow:hidden` na barra; hachura de "sem vídeos em 90 dias" igual à de "ainda não coletado" (diferem só pelo texto); pílulas quebradas no 1440 vêm de B1.

## As 5 dúvidas da NOTAS.md

**D1. Limites de constância 1,8 e 5 (razão p75/p25): troque os rótulos, mostre a razão, calibre com dado real.**
Sem dado real não cito número do "certo". O que se sabe: views por vídeo costumam variar muito dentro de um canal, então 1,8 como limite de "Constante" provavelmente deixa quase todo canal real em "Variável" ou pior; no mockup só 4 de 22 passam, e foi dado que eu desenhei para isso. Não valido sem medir. **Solução pronta:** (a) deixar de rotular o canal e rotular a **faixa**: "faixa estreita / média / larga" com o símbolo ＝ ～ ≋ já desenhado (descreve a medida, sem juízo); (b) mostrar a razão na linha: "p75 é 3× o p25" ou simplesmente "faixa de 3×"; (c) os dois cortes saem dos **terços da distribuição real dos canais do Observatório** (uma consulta do Phil sobre os canais acompanhados antes do código), registrado no ⓘ com a data; até lá provisório **2 e 6**, marcado como provisório no ledger. Ordenar "mais constante" continua pela razão, sem depender dos cortes.

**D2. "Igual" em 0,5% em 28 dias: derrubar.** Percentual fixo pune canal pequeno (+5 em 410 = 1,2% aparece como ▲) e promove canal grande (+1.800 em 603 mil = 0,3% aparece como ＝ e ainda mostra "+1.800"). O ruído de inscrito vem do **passo de arredondamento**, não de um percentual. **Solução:** ＝ só quando a contagem é exata (menos de 1.000) e o ganho é **0**. Acima disso, variação menor que o ruído vira "sem medida" com o motivo "dentro do arredondamento (±1 mil)", ver D3. Sai a linha "Igual (＝): variação menor que 0,5%" do ⓘ e a contagem "ficaram iguais" do resumo vira "sem variação" só para o ＝ exato.

**D3. Regra do arredondado: trocar por comparação do ganho com o passo.** Texto/regra, sujeito à confirmação do Phil na API: passo = 10^(⌊log10(n)⌋ − 2) (n abaixo de 1.000 = exato; 9.840 → passo 10; 143.000 → 1.000; 1,42 mi → 10 mil). **Mede** se |ganho| ≥ 2 × passo do maior dos dois totais (os dois números vêm arredondados, o erro soma). Caso contrário: pílula hachurada "dentro do arredondamento (±{passo})" e o ganho **não** aparece como número, para não mostrar "+1.800" ou "0" como fato. Isso aplica a Q6 do dono ("não dá para medir onde o arredondamento esconde a diferença") sem inventar limiar. Texto do ⓘ: "**Arredondamento:** o YouTube mostra a contagem pública com 3 algarismos (a partir de mil inscritos). Quando o ganho é menor que duas vezes esse arredondamento, não dá para saber se o canal subiu, caiu ou ficou igual; por isso aparece 'dentro do arredondamento' e não um número." Corrigir o dado sintético (todos os totais com 3 algarismos) para o mockup não ensinar o contrário. Resultado no mockup: Mochila (+1.800, passo 1 mil, limiar 2 mil), Terra Firme e Janela do Fundo passam a "dentro do arredondamento"; recalcular todas as linhas ao corrigir o dado sintético.

**D4. Mínimo de vídeos para mediana e faixa: 5 para a faixa, 3 para a mediana provisória.** Quartil de 3 ou 4 vídeos é a posição de um ou dois vídeos, e a "faixa" vira escolha de 2 vídeos. **Regra:** 5 ou mais em 90 dias = mediana + faixa; 3 a 4 = mediana provisória, ponto fraco, faixa pontilhada **ausente**, pílula "poucos vídeos (n)"; 0 a 2 = sem mediana, "poucos vídeos (n)" hachurado (diferente de "sem vídeos em 90 dias", que é 0). O mockup hoje desenha faixa com 4 vídeos (Guia Nenhum) e 5 (Baldeação, Voo Rasante): Guia Nenhum passa a "provisório". Valor 5 é regra de leitura estatística comum, não medida do projeto; registrar como provisório.

**D5. Estados que faltam: o que entra (decisão 75 do dono: erro = ícone de aviso, negado = pastilha "restrito", nunca "não medido"; rótulos meus).**
- **Carregando** (`?estado=carregando`): em cada seção, esqueleto com a frase-resumo cinza ("Calculando as referências...") e linhas com régua vazia pontilhada; nada de zero nem barra. Se passar de ~8 s: "Está demorando. A conexão pode estar lenta." + botão "Tentar de novo".
- **Erro por seção** (`?estado=erro`): uma seção falha, a outra continua. Ícone de aviso + "Não foi possível carregar as referências. Seus dados não mudaram." + botão **Tentar de novo** (o foco vai para ele) + hora da última leitura boa se existir. Nunca mostrar "Sem canais" nem "0".
- **Parcial:** se só alguns canais falharam, a lista aparece e uma faixa no topo da seção diz "3 canais não carregaram. Tentar de novo"; cada linha afetada leva o ícone de aviso e "falhou", não hachura.
- **Conexão caiu depois de carregar:** manter o último dado, com marcação "dados de {hora}" e aviso de rede; ordenar continua funcionando (é local).
- **Sem acesso** (`?estado=restrito`): pastilha **"restrito"** no lugar da lista, com "Só quem administra o site vê estes dados."; sem ícone de aviso.
- **Só-leitura:** a tela não tem ação de escrita (ordenar não grava nada no banco), então não há estado de só-leitura próprio; **não criar**. O que existe é acesso negado, acima.
- **Dado antigo:** se a última coleta tem mais de 2 dias, uma linha pequena no topo: "Última coleta há 3 dias."

## Pedido ao desenhista, em ordem
1. B1 (`#app{display:block}`), refazer capturas 1440/390.
2. B2/B3/D2/D3: nova regra de "igual"/"dentro do arredondamento", dado sintético coerente, ⓘ reescrito.
3. C1 (escala), C2 (frases), C3/D1 (rótulos e razão), C4 (nome "sem medida"), C7 (% fora da barra).
4. C6 (URL/foco/Esc) e D4 (mínimo 5).
5. D5 estados novos e C8 (abas no celular).
Depois, nova rodada minha e da Naksu; o ⓘ e a tela precisam voltar ao dono com as duas posições se discordarmos.

## Re-revisão v2 (Logan)
Verificado em Chromium headless sobre `file://`, 1440 e 390, estados cheio, erro, parcial, antigo, restrito, lento, vazio, magro; texto da página e dos dois popovers lido por script. Não verificado: leitor de tela, aparelho real, rede lenta real, Esc/foco do ⓘ (confiei no teste declarado em NOTAS.md).

**Veredito: APROVA COM CONSERTOS MENORES.** Sem rodada extra.

**Resolvidos.** B1: sem rolagem horizontal, régua 508 px (1440) e 214 (390). B2: "sem variação" só em contagem exata (Pé na Estrada, 640); Mochila, Terra Firme e Janela do Fundo viram "sem medida · dentro do arredondamento (±1 mil)", sem número de ganho. B3: ⓘ de Inscritos agora diz 3 algarismos a partir de mil e ganho >= 2x o arredondamento; conferi o dado sintético (Rota Solta +30.000 com passo 10 mil, Dois Passaportes +17.000, Quilômetro +3.000: todos passam; Estrada de Terra −100 em 9,8 mil passa com passo 10). C1 a C8, S1 a S3, D1 a D5: aplicados como pedido (frase com "vídeo típico" e "seu canal em 7º", faixa estreita/média/larga com razão, "sem medida" único, % fora da barra, abas no celular, 10 linhas + "Ver todos os 27", estados novos com Tentar de novo e "restrito" sem ícone de aviso).

**Fricção nova (só menores).**
- M1. ⓘ de Referências: o texto "[a confirmar com a engenharia de dados]" é nota de bastidor dentro da frase do usuário. Não pode ir ao código. Texto final conforme a decisão do Phil: se entram, "Vídeos com menos de 7 dias entram com as views que têm hoje, ainda em crescimento; em canal que publica muito, isso puxa o vídeo típico para baixo."; se não entram, "Vídeos com menos de 7 dias ficam de fora, porque ainda estão ganhando views." (nesse caso a contagem de 5 vídeos também os exclui; escrever isso no ⓘ da regra de poucos vídeos). Minha preferência de método: excluir, porque a frase honesta do primeiro caso confessa um viés que a tela não consegue mostrar.
- M2. Unidade da lista de Inscritos: "1.420 mil no total" (Rota Solta) contradiz o próprio ⓘ ("1,42 milhão como 1.420.000") e a prosa ("1,2 mi"). Acima de 999 mil, escrever "1,42 mi" na lista (e "1,18 mi" em Referências), mantendo "mil" abaixo disso.
- M3. Estado antigo diz "Sem conexão" mesmo quando a causa é a coleta atrasada (as duas causas se confundem). Texto: "Mostrando os dados de 11/10, 06:40 (última coleta há 3 dias)." e acrescentar "Sem conexão." só se o navegador estiver offline.
- M4. Magro: frase diz "0 sem medida". Omitir a contagem quando for zero (idem "0 com mediana provisória"). Parcial: "19 canais medidos" e "3 sem medida" convivem com "3 canais não carregaram"; trocar para "19 canais carregados; 3 não carregaram" para não parecer o mesmo grupo.
- Para a Naksu: nada novo.

Pedido ao desenhista: M1 a M4 num só passe; M1 depende da resposta do Phil e pode ficar para a implementação, desde que o texto com colchetes não saia do mockup para o código.
