# Terceira revisão de UX (12/10/2026): conferência dos itens abertos

Escopo fechado: os itens da `REVISAO-UX-2.md` e a "Rodada 2" de `AJUSTES-UX.md`. Método: Playwright por `file://`, fontes carregadas antes de medir; 108 combinações (27 páginas/estados x 1440/390 px x 2 temas) com auditoria de contraste de todo texto, fonte mínima, alvos de 44 px e rolagem lateral; scripts próprios para C6, C33, C35, retenção e seletor. Capturas em `ux-revisao-3-shots/`. Nada foi editado; navegador fechado.

## Resumo

| Veredito | Telas |
|---|---|
| Pronto para o dono | 8 de 9: 1 (canal), 2 (gráfico de impressões), 3 (vídeo), 4 (taxa de clique), 5 (% assistido / aba Retenção), 6 (curva de retenção), 8 (c2-trocas), 9 (comparar-direcao) |
| Volta para ajuste (uma linha) | 1 de 9: 7 (c1-seletor), só por causa do estado padrão aberto (achado N1) |
| Reprovado | 0 |

Itens da rodada 2: **C6, C33, C35, retenção "na média", Popover sem suporte e lista a 390 x 667: todos fechados de fato.** Regressões nas 6 telas que estavam prontas: **nenhuma**. Um achado novo (N1) e a diferença de 3 px não se reproduz (abaixo).

## Conferência item a item

| # | Item | Resultado |
|---|---|---|
| 1 | C6, canal.html?caso=sem-dado | **Fechado.** 10 cartões, 0 hachuras e 0 "não medido" dentro deles (1440 e 390, escuro e claro). A explicação única está na nota sobre a grade: "Nestes cartões, views por dia e alcance estão não medidos: a coleta diária ainda não rodou para este canal." (13 px, `--muted`, passa de 4,5:1). O porquê continua dito no topo: "Canal parado há 666 dias; ainda sem números de alcance" e "Não medido: os números de alcance ... ainda não chegaram ... nenhum deles é zero, só falta medir". Sugestão: a mesma ausência é dita 4 vezes acima da grade (nota, painel, "Impressões por dia", "Taxa de clique"); dá para cortar uma. |
| 2 | C33, cabeçalho "Diferença" | **Fechado.** Cabeçalho "Diferença / o lado maior sobre o menor" nos 3 pares x 2 bases (90 dias, todos) x primeiros dias cheio. Li as 9 linhas de cada combinação: toda frase começa pelo maior dos dois, conferido com os números (ex.: 5,36 mil x 6,1 mil: "Aldinho: +14%"; 118 x 41,2: "Lodir: 2,9x"; 1,53 mil x 15,4 mil: "Lodir: 10x os inscritos de Leo Khev"; engajamento 7,2% x 4,1%: "Lodir +76%"; Leo Khev em "todos": "Leo Khev: +22% de engajamento", correto porque 7,4% > 6,1%). Zero ocorrência de "em relação a A". |
| 3 | C35, `#8A5A00` no claro | **Fechado.** Lido da página em 15 telas x 2 larguras: texto, borda e preenchimento nessa cor passam em todos os fundos onde aparecem (tabela abaixo). Distinta do laranja "seu canal": ΔE 30,0 (era 8,6) e do lado A `#5C4710`: ΔE 22,2, luminância 1,50; em simulação de deuteranopia, ΔE 20,5 e 21,8. Em cinza o ocre e o laranja ficam próximos (luminância 1,12): quem separa é o formato (▼, selo "parado" com pausa, a palavra) e a cor "seu canal" nunca é texto de estado. Ressalva menor: a linha destacada da Retenção não aparece em nenhum caso do mockup (nenhum vídeo atende "views acima do normal e % assistido 3 pontos abaixo"); medi forçando a classe `alvo`: 4,65:1. |
| 4 | Retenção "na média" | **Fechado.** Caso cheio, 12 vídeos: 2 verdes (+4, +3), 1 âmbar (−3), 9 cinzas ("= na média da faixa (40%), +1 ponto", de −2 a +2; o "0" sai sem "ponto"). Legenda: "acima (3 pontos ou mais) / na média (até 2 pontos para cima ou para baixo) / abaixo (3 pontos ou mais)"; ⓘ: "até 2 pontos ... é ruído e não ganha cor; de 3 pontos em diante é acima ou abaixo". As três dizem a mesma regra. |
| 5 | Seletor (c1) | **Fechado, com um achado novo no estado padrão (N1).** Com e sem Popover API (apaguei `showPopover`/`hidePopover` e fiz `:popover-open` lançar `SyntaxError` antes do carregamento): a lista abre nos dois lados, nos dois temas, a 390 x 568, 667, 844 e 1440 x 900; 0 erro de página; lista dentro da janela em todos os 32 casos (A termina em 556 / 655 / 722; B em 556 / 655 / 832; 1440: 706); `elementFromPoint` devolve a própria opção em 100% das opções visíveis (varredura de rolagem interna incluída). Teclado, 180 passos de ↓ e ↑ pelos grupos, com e sem Popover: o item ativo nunca fica coberto pelo cabeçalho de grupo; Enter troca, Esc fecha e devolve o nome, Tab fecha e vai ao campo B. |
| 6 | Regressão, 9 telas | Capturas de todas as 108 combinações olhadas (canal, vídeo, comparar-so, c2, direção) e comparadas com o que estava pronto: gráfico de impressões, vídeo (4 casos), taxa de clique, retenção, seletor e troca de descrição seguem como estavam; sem rolagem lateral, sem erro de página. |
| 7 | Auditoria geral | Zero texto abaixo de 4,5:1; zero fonte abaixo de 12 px; zero alvo abaixo de 44 px a 390 px; zero rolagem lateral da página nas 108 (o único "transbordo" lido é a faixa de abas do CMS, que rola por dentro, de propósito). |

### Diferença de 3 px na lista aberta a 390 px: não reproduz

Medi 12 combinações (4 alturas x aberto, outro-lado, digitando), três instantes cada (50 ms, 450 ms, 1,65 s): o vão entre o texto de apoio e a lista é 6,0 px em todas, estável; o fundo da lista fica 12 px acima da borda da janela em todas; os valores absolutos são idênticos aos que medi na revisão 2 (302 a 722, 435 a 655, 502 a 832). Único resíduo de subpixel: o campo do lado B fica em y fracionário (470,6 contra 271,0 do A) porque o cartão do A ocupa uma altura não inteira. Uma comparação de captura contra captura engana: a lista rola para o item ativo (ou para onde a varredura parou) e o conteúdo muda de posição; não é desvio de layout.

## Achado aberto

| Sev. | Tela e estado | Achado | Evidência | Conserto |
|---|---|---|---|---|
| **corrige** (N1) | c1-seletor, página padrão (sem parâmetro = `estado=aberto`) | A lista A abre sem foco no campo, então o `blur` que fecha a lista nunca dispara: (a) a 390 px a lista A cobre o Lado B inteiro, inclusive o campo (`elementFromPoint` no centro do campo B devolve "lista A"; tocar ali escolhe um canal do A em vez de abrir o B) e não há toque fora que feche; (b) a 1440 px, tocar no campo B deixa as duas listas abertas ao mesmo tempo (`cbALb` e `cbBLb`). | `c1-padrao-390.png`, `c1-padrao-tocou-B-1440.png`; script `c1pad.js` | No mapa de estados, para `aberto` chamar `cb.inp.focus()` como já fazem `outro-lado`, `digitando` e `teclado`; ou tornar `fechado` o padrão e deixar `aberto` só por link. Opcional: `abrir()` de um lado fechar o outro. |
| sugestão | canal sem-dado | "Ausência" dita 4 vezes acima da grade. | `canal-caso_sem-dado-1440-escuro.png` | Cortar a nota de baixo da faixa ou o lead do painel. |
| sugestão | c2, 390 px | Fundo do cartão selecionado não preenche o cartão (moldura de 6 px). Igual à revisão 2, não pedido. | `c2-trocas-canal_nomade-390-claro.png` | Preencher. |
| sugestão | comparar-direcao, claro | Selo A (marrom `#5C4710`) e ▼ ocre são da mesma família; separam por forma (quadrado com letra x triângulo) e ΔE 22. | `comparar-direcao--1440-claro.png` | Nenhum, só registro. |

**O estado aberto como padrão ajuda ou atrapalha o dono?** Ajuda a 1440 px na primeira vista (mostra a lista, o grupo "Seus canais" e a regra de "exemplo" sem clicar), mas atrapalha de três formas: a 390 px esconde o Lado B e não dá para dispensar a lista; ao tocar no outro campo ficam duas listas; e o dono vê a tela do comparador coberta por uma lista antes de ver o comparador. Com o conserto de N1 (foco no campo) ela passa a se comportar como as demais; ainda assim eu abriria com a lista fechada e deixaria "Aberto" a um clique na barra, porque a pergunta dele é "como o campo se parece" e o campo fechado é a tela real.

## Medidas

| Item | Medida | Regra |
|---|---|---|
| `#8A5A00` sobre página `#F7F2E9` | 5,32:1 | 4,5:1 texto, 3:1 marca |
| sobre cartão `#FBF7F0` | 5,55:1 | idem |
| sobre `--surface-2` `#F2EBDF` | 5,00:1 | idem |
| sobre linha destacada (accent a 10% sobre a página) | 4,65:1 | idem |
| letra branca sobre o quadrado ▼ | 5,93:1 | 4,5:1 |
| ΔE de `#8A5A00` a `--accent` / lado A / âmbar `#B45309` / `--muted` | 30,0 / 22,2 / 23,2 / 40,4 | > 20 |
| razão de luminância a `--accent` / lado A | 1,12 / 1,50 | informativo |
| `--accent` sobre a linha destacada | 4,14:1 | 3:1 (filete, não texto) |
| Elementos nessa cor lidos nas telas | "Canal parado...", "666 dias", selo "parado", "−3 pontos", ▼, triângulos da curva: todos 5,32 a 5,55 | |
| Texto abaixo de 4,5:1 (108 combinações) | 0 | |
| Fonte abaixo de 12 px | 0 | |
| Alvos abaixo de 44 px a 390 px | 0 | |
| Rolagem lateral da página (108) | 0 | |
| Lista do seletor dentro da janela (32 casos, com e sem Popover) | 32 de 32 | |
| Opções tapadas (`elementFromPoint`, 100% visíveis) | 0 | |
| Passos de teclado com item ativo coberto | 0 de 720 (180 x 4 configurações) | |
| Vão campo-lista | 6,0 px em todos | |

## Roteiro para o dono avaliar

Base: `file:///Users/figueiredo/Workspace/bythiagofigueiredo/docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/` (ou pelo `index.html`). Alterne o tema pela barra de cima.

1. **Canal (magro, o caso real).** `canal.html?caso=magro`. Em 30 s: a frase em âmbar "Canal parado há 666 dias" abre a tela; só a célula "666 dias [pausa] parado" tem cor; 25% e "0 views por dia" ficam cinza; a taxa diz que ainda não dá para dizer. Veja também `?caso=sem-dado` (cartões limpos, uma nota só). Decisão sua: o âmbar de "parado/descendo" (no claro, ocre) serve para dizer "atenção sem alarme"?
2. **Gráfico de impressões por dia.** `canal.html?caso=cheio`, bloco "Impressões por dia do canal". Passe o mouse sobre as barras e use as setas; barra cheia = dado, caixa vazada = zero medido, hachura = não medido. Decisão: ler "zero" e "não medido" como coisas diferentes basta, ou é sutil demais?
3. **Vídeo.** `video.html?caso=cheio`, depois `?caso=magro` e `?caso=novo`. Olhe o cabeçalho e o que cada seção diz quando o vídeo é novo ou tem 2 views. Decisão: o texto "com 2 views não dá para posicionar" é o que você quer ler no lugar de um número?
4. **Taxa de clique.** `video.html?caso=cheio` e `?caso=magro`, bloco "Taxa de clique deste vídeo". Cheio: duas faixas quase se tocam; magro: faixa tracejada "ainda não conclui". Decisão (veto de 09/10): manter a taxa por vídeo na tela agora que o intervalo impede cravar posição?
5. **% assistido (aba Retenção).** `canal.html?caso=cheio&aba=retencao`. Procure: 2 linhas verdes (+4, +3), 1 âmbar (−3), o resto cinza "na média" (−2 a +2). Decisão: a régua "na média = até 2 pontos" é a sua? Se quiser mais ou menos sensível, é uma constante.
6. **Curva de retenção.** `video.html?caso=cheio`, bloco "Retenção". Frase "Metade das pessoas já saiu aos 6:52", linha da mediana, trechos revistos em cinza, triângulos das maiores saídas. É exemplo (marcado). Decisão: os números de exemplo mostram o que você quer ver quando a coleta existir?
7. **Seletor de canal.** `c1-seletor.html?estado=fechado` (o padrão abre com a lista A aberta e hoje tem o defeito N1; peça a correção antes). Clique no campo, digite "vida", use ↓ ↑ Enter Esc; abra o lado B e veja "tnFigueiredo" indisponível; teste a 390 px. Decisão: agrupar por "Seus canais / Viagem / Entretenimento / sem nicho" e mostrar "exemplo" nos fictícios está certo?
8. **Troca de descrição.** `c2-trocas.html?canal=nomade` e `?canal=paddy`. Olhe as marcas de semana: caixa tracejada = semana sem troca, "1" e "2+" em violeta; "costuma trocar". Decisão: contar a descrição por semana (antiga para recente) responde à sua pergunta ou prefere por vídeo?
9. **Comparar dois canais, direção.** `comparar-direcao.html` (par Lodir x Aldinho), depois `?par=lodir-leo` e `?tema=claro`. Olhe o par ▲ subindo x ▼ descendo, a ressalva "pode ser só idade" na própria linha, e a coluna "Diferença" (sempre o lado maior primeiro). No Leo Khev, as linhas ficam "não medido" com um aviso só. Decisão (Parte E da revisão 2): verde para subindo e âmbar para descendo, só na direção, nunca como "melhor e pior"?

## O que não verifiquei

Leitor de tela (só atributos ARIA e texto de `role="status"`); toque em aparelho real (emulação de toque do Chromium); Safari, Firefox e Opera de verdade (o cenário sem Popover foi simulado); zoom de 200 a 400% e movimento reduzido; fontes da internet (usei as do sistema); dados de exemplo contra o banco; a escala de cinza desta rodada foi só calculada (luminância e daltonismo), não refeita captura por captura.
