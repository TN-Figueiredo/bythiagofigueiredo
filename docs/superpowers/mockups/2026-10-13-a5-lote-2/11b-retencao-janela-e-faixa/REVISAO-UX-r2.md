# Revisão de UX, rodada 2: mockup 11b (Retenção do vídeo próprio: janela e faixa do YouTube)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Pasta: `docs/superpowers/mockups/2026-10-13-a5-lote-2/11b-retencao-janela-e-faixa/`.
Método: Chromium headless (Playwright, servidor estático próprio nas portas 47761 a 47765, derrubado ao fim; não usei a 3099 nem os specs do projeto). 13 estados x 3 janelas, 1440 / 390 / 360 px, os dois temas (182 combinações medidas por `getBoundingClientRect` e `getComputedStyle`). Olhei as capturas `r2-*` da implementadora e gerei as minhas em `shots/revisao-r2-*.png` (4 em escala de cinza a 390 px, 2 a 1440 escuro). Não toquei em nada fora desta pasta de mockup. Os scripts de medida ficaram no scratchpad da sessão.

## Veredito: PODE IR AO DONO (zero bloqueio, zero "corrige" aberto)

Os 2 bloqueios e os 6 "corrige" da rodada 1 foram resolvidos, medidos, e o ajuste não criou defeito novo que bloqueie. Sobram 9 melhorias, nenhuma impede a ida ao dono.

## A pergunta de quem abre

"Esse vídeo segura as pessoas bem ou mal, onde elas saem, e isso vale para a estreia ou para a vida toda?" Resposta no primeiro olhar depois de chegar à seção: frase no topo ("metade já saiu aos 7:14, 42% do vídeo"), três cartões com a curva de cada janela e, logo abaixo, a faixa "▲ Acima de vídeos de duração parecida" com a marca cravada na régua (marca 14,5:1 contra o cartão). A 390 px a faixa fica a ~456 px do topo da seção; cabe numa tela. O veredito "bem ou mal" está na faixa, que vem depois da frase e do seletor (melhoria 1, decisão de ordem do dono).

## Reconferência dos bloqueios e "corrige" da rodada 1

| Item | Resolvido? | Evidência (medida por mim) |
|---|---|---|
| B1 leituras sem rótulo a 390 px | Sim | `shots/r2-leituras-abertas-390-claro.png`: cada valor traz "Metade saiu aos", "No fim", "Comparação do YouTube" acima; "mais recente" na primeira linha. |
| B2 rótulo da faixa fora do cartão | Sim | Rótulo dentro do cartão e da régua em todos os 10 estados com faixa, 1440, 390 e 360: `zero` 390 rótulo 49 a 99 (cartão 33 a 357, régua 47 a 343); `zero` 360 rótulo 49 a 99 (cartão 33 a 327); `short` 390 rótulo 291 a 341. Nenhuma violação nas 182 combinações. A haste continua no valor (`shots/r2-zero-390-claro.png`). |
| C1 frase abaixo do seletor | Sim | Frase e chip "Leitura de dd/mm" vêm antes do seletor, como no lote 1 (`shots/index-caso-tipico-1440-escuro.png`). |
| C2 cartões desalinhados a 390 | Sim | Linha "Metade saiu aos" a **66 / 66 / 66 px** do topo do cartão, nas 13 telas x 3 janelas a 390 e a 360; altura igual nos três cartões em cada estado. Rótulo curto "Vida toda" a 390. |
| C3 rosa em "curva privada" | Sim | `shots/r2-leitura-390-claro.png`: caixas com cadeado em `--dim` sobre `--sunk`, sem rosa. |
| C4 30 dias lido antes de fechar | Sim | Conferi data a data (publicação + 7 ou + 30 contra a leitura): tipico 30/08 (7d lido 08/09, 30d lido 01/10), serrilhada/vazia 25/08 (05/09 e 28/09), zero 12/08 (21/08 e 16/09), aberta 25/09 (7d 05/10, 30d fecha 25/10), short 28/09 (7d 07/10, 30d fecha 28/10), antigo 2015 (fechou 21/03 e 13/04/2015), novo e erro-sem. Todas coerentes com a coleta desde 15/08. |
| C5 palavra "lida" | Sim | Nenhuma ocorrência de "lido/lida" no texto visível das 39 telas (só como código interno `w.e === 'lida'`). A tela diz "buscada". |
| C6 zona ativa da régua (3:1) | Sim | Contraste da zona ativa contra o cartão, composto: escuro 3,09 a 3,48; claro 3,18 a 3,32 (todos os estados com faixa, 1440 e 390). Borda da régua 4,86 (escuro) e 5,59 (claro). |

## Veredito por estado e largura

Par obrigatório (1440 escuro, 390 claro) visto nas capturas; os outros dois cruzamentos (1440 claro, 390 escuro) por medida (rolagem, alvo, fonte, contraste).

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| típico (vida, 7, 30) | pronto | pronto | |
| aberta (janela 30 e vida) | pronto | pronto | barra "dia 18 de 30" com contorno pontilhado |
| short (curva a 140%, marca em 0,97) | pronto | pronto | rótulo preso à régua, dentro do cartão |
| antigo (7 e 30 "fechou antes da coleta") | pronto | pronto | melhoria 3 (a frase "a janela não existe") |
| serrilhada (41 views) | pronto | pronto | faixa traz "Só 41 views: leia como indício" |
| vazia (YouTube sem curva) | pronto | pronto | melhoria 4 |
| sem-faixa | pronto | pronto | |
| zero (comparação 0,02; "0" em caixa vazada) | pronto | pronto | zero medido distinto de não medido |
| não coletada (hoje) | pronto | pronto | em cinza: texto e hachura seguram |
| novo | pronto | pronto | |
| erro com leitura anterior | pronto | pronto | |
| erro sem leitura | pronto | pronto | melhoria 5 (texto "não foi buscada") |
| só leitura | pronto | pronto | sem rosa, cadeado e texto |

## Bloqueios

Nenhum.

## Melhorias (não bloqueiam; ordem de valor)

1. **Veredito depois do seletor** (`tipico` 1440): a frase diz "metade saiu aos 7:14 (42%)" e o "bem ou mal" só vem na faixa, ~300 px abaixo, depois dos três cartões. É a melhoria 9 da r1, decisão de ordem do dono. Se ele preferir o veredito primeiro, a faixa sobe para entre a frase e o seletor (a 390 já empilha).
2. **"Salvo neste navegador" aparece sem ter salvo** (`?caso=aberta&janela=30`, nada clicado): medi `localStorage` nulo e a linha visível. É efeito de a URL vencer a escolha salva, só no mockup. No produto, mostrar a linha só depois do clique (ou só quando o valor veio do navegador). Código: `11b.js` linha 56 usa `janela === PADRAO` como condição.
3. **"A janela não existe para este vídeo"** (frase de topo de `antigo` e `nao-coletada`, janela 7 e 30 fechadas antes da coleta): a janela existiu; o que falta é a medida. O painel logo abaixo diz certo ("fechou em 21/03/2015, antes de começarmos a coletar"). Trocar o topo por "Primeiros 7 dias: não medida, a janela fechou antes da coleta".
4. **`vazia`: a frase de topo não diz de qual janela** ("O YouTube não devolveu curva para este vídeo (poucas views)" nas três janelas, mas a de 7 dias foi tentada em 05/09 e a vida em 12/10). Prefixar com a janela ("Nos primeiros 7 dias, o YouTube não devolveu curva…").
5. **`erro-sem`: "A curva ainda não foi buscada"** convive com o aviso "A primeira tentativa falhou em 12/10": buscada foi, e falhou. Trocar por "A curva ainda não chegou".
6. **Teclado: Home e End não vão ao primeiro e ao último cartão** do grupo (medido: Home com foco em "30 dias" não saiu dele). As setas funcionam (um só item no Tab, 0 / -1 / -1). Padrão APG de radiogroup pede também Home e End; é opcional no mockup, obrigatório no produto.
7. **Primeira leitura da vida inteira com 15 dias de buracos** (`tipico`: coleta desde 15/08, vídeo de 30/08, primeira leitura "desde 14/09"; `erro`: 28/09). Sem erro, mas o implementador pode copiar a cadência. Dizer na NOTAS qual é a periodicidade da leitura da vida inteira.
8. **PLANO.md ficou para trás do desenho**: diz "frase à esquerda e faixa à direita, lado a lado no topo" e a ordem seletor, frase, faixa; o desenhado tem frase, seletor, faixa em cartão próprio (empilhados, mesmo a 1440). A NOTAS está certa. Atualizar a seção "Hierarquia" do PLANO.
9. **Nome acessível do radiogroup** lê "Janela da curva Como a janela é contada" (junta o ⓘ). Apontar `aria-labelledby` só para o texto "Janela da curva".

## Tabela de medidas

Contraste (WCAG, composto sobre o fundo composto, lido do estilo computado; menor valor de texto na seção `.rj-sec`, 9 estados nos dois temas):

| Elemento | Escuro | Claro | Mínimo |
|---|---|---|---|
| Texto menos contrastado da seção (`.rj-s` "Leitura de dd/mm", "só quem edita vê", eixos) | 5,90 | 6,43 | 4,5 ok |
| Texto de apoio `.exband`, `.rj-lab` | 6,18 | 7,13 | 4,5 ok |
| Símbolos ▼ (âmbar) e ▲ (verde) como texto | 7,26 | 5,55 / 6,37 | 4,5 ok |
| Pastilha "não medido" | 7,76 | 6,67 | 4,5 ok |
| Frase-resumo (16 px) | 14,48 | 15,76 | 4,5 ok |
| Zona ativa da régua contra o cartão | 3,09 a 3,48 | 3,18 a 3,32 | 3 (gráfico) ok |
| Borda da régua | 4,86 | 5,59 | 3 ok |
| Marca do vídeo na régua | 14,5 | 15,8 | 3 ok |

Geometria e interação (182 combinações, ponteiro grosso a 390 e 360):

| Medida | Resultado |
|---|---|
| Rolagem horizontal a 390, 360 e 1440 | 0 px em todas |
| Alvo menor que 44 x 44 px a 390 e 360 | nenhum (ⓘ 44, "Ver as N leituras" 44, "Voltar ao padrão" 44, cartões 99 x 148 a 164) |
| Texto abaixo de 12 px | nenhum |
| Cartões, linha "Metade saiu aos" do topo | 66 / 66 / 66 px a 390 e 360; 67 / 67 / 67 a 1440 |
| Rótulo da faixa dentro de cartão e régua | sim, nos 10 estados com faixa |
| Popover do ⓘ da faixa a 390 | 366 x 328, de x=12 a 378, dentro da tela |
| Foco visível | 2 px sólido `--accent` (laranja escuro no claro, laranja no escuro) em cartão, ⓘ e resumos |
| Ordem de Tab na seção | cartão da janela, ⓘ da faixa, "Ver a curva em números", ⓘ "Como a curva mudou", "Ver as N leituras" |
| Esc no popover | fecha e devolve o foco ao ⓘ |
| `color-mix()` | 0 em CSS, JS, dados e HTML (só o comentário "sem color-mix") |
| Erro de JavaScript na página | 0 nas 182 combinações |
| `aria-live` | uma região `.sr` (polite) com só a frase-resumo; o cartão selecionado tem `aria-checked`; nome do radio "7 dias Metade saiu aos 7:03 Leitura de 08/09" |

## Regras do dono, uma a uma

| Regra | Estado |
|---|---|
| Frase-resumo no topo | ok (frase única, antes do seletor, em todos os estados, inclusive os sem curva) |
| Régua ou barra de relance | ok: régua de 0 a 1 com marca; miniatura da curva nos cartões; "dia N de M" |
| Cor estável por significado, "não medido" incluso | ok: verde ▲ / âmbar ▼ / neutro ＝ como no lote 1; rosa só para "não medido"; privado em `--dim` |
| Símbolo junto da cor | ok: ▲ ▼ ＝, relógio, aviso, cadeado, ●; lido em cinza nas 4 capturas `revisao-r2-cinza-*` (o ▼ da zona de baixo e a palavra "abaixo" em negrito sustentam) |
| Método no ⓘ, não em prosa | ok (nenhum parágrafo acima de 2 linhas; o nome técnico `relativeRetentionPerformance` só dentro do ⓘ) |
| Zero medido distinto de não medido | ok: caixa vazada "0" contra hachura rosa; nenhuma curva reta em zero |
| Sem bloco monocromático nem prosa | ok |
| Sem jargão | ok na tela; "buscada" e "Leitura de" nos lugares de "lida" |
| Sem `color-mix()` | ok |
| 1440 escuro, 390 claro, alvo 44, foco, aria | ok |
| Estados desenhados | ok: os 13, nas 3 janelas |
| Consistência com o lote 1 | ok: tokens, tipografia, "+ novo", memória da escolha e "Voltar ao padrão", ordem frase antes do seletor; a diferença (cartão com miniatura) está declarada |

## As três coisas que mais pesam no conjunto agora (todas em melhoria)

1. A decisão de ordem do veredito (melhoria 1) é do dono; é a única que muda a leitura de relance.
2. Frases de topo que prometem mais ou menos do que o dado diz ("não existe", "não foi buscada", sem a janela citada): melhorias 3 a 5, troca de texto.
3. Detalhes de produto que o mockup mascara (lembrança sem gravar, Home/End, cadência da vida inteira): melhorias 2, 6 e 7, para a NOTAS repassar ao implementador.

## O que NÃO consegui verificar

Leitor de tela real (só `ariaSnapshot` do Chromium), Safari, Firefox e o Opera do dono (confirmei que não há `color-mix`, não abri no Opera), toque num aparelho (emulei ponteiro grosso), escala de cinza só em 4 estados (os demais por inspeção do símbolo), 1440 claro e 390 escuro por medida e não por olhar as capturas, e a regra de coleta contra o código real (não revisei implementação). Os cortes 0,45 e 0,55, "a comparação muda com a janela?" e "quantas views separam serrilhada de boa" são decisões do dono (NOTAS, dúvidas 1, 3 e 5) e não as julguei.
