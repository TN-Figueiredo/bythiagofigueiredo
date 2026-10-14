# Revisão Naksu, peça 8 (vídeos antigos), rodada 1

Arquivos lidos: `19-mes-fora-do-banco/peca8-canal.html`, `peca8-estados.html`, `peca8.js`, `peca8.css`, seção em `arquivo.html`. m19.css e NOTAS só lidos. Aberto por `file://` (Playwright, Chromium); nenhum servidor foi subido (47701 intocada, 47702 não usada). Capturas e `medidas.json` em `revisao-naksu-shots/peca8-1/` (13 telas x 1440/390 x claro/escuro; seção do Arquivo isolada; diálogo; texto hostil; cinza). Fontes do Google não carregam offline: medi com a fonte de reserva (largura de linha pode variar poucos %).

## Veredito: VOLTA PARA AJUSTE. Nenhum bloqueante. 6 "corrige", 5 sugestões.

Resumo: 1 peça, 3 páginas de mostra (canal/vídeo, estados, Arquivo). Os 3 defeitos que mais pesam: (1) o gráfico do vídeo a 390 px renderiza texto de 7,7 px; (2) o estado "Arquivo não lido" e o caso "1 no arquivo" mostram texto de gabarito ("N trocas", "1 vídeos") e o esqueleto de carregamento tem metade da altura final (a página pula); (3) "Mostrar mais 25" não devolve nem anuncia foco, e a frase digitada rejeita sem acento, contra o que o próprio ⓘ afirma.

## 1. O que acerta (preservar)
- Barra de três segmentos: acompanhados cheio `--muted` (6,18:1 escuro, 7,13:1 claro contra `--surface`), mensal com preenchimento próprio e borda 2 px `--dim` (4,86:1 / 5,59:1), arquivo vazado com borda `--dim`. Em escala de cinza os três se leem (cinza-barra-390-escuro.png, cinza-barra-1440-claro.png); ◐ e caixa de arquivo diferem do pontilhado. Zero medido com a caixa `--im-zero` (dez26, pouco) e não medido em hachura com motivo.
- Todo número com data ("lido em 02/05/2028", "na passagem...: 7,6 mil views, lido em 28/11/2027"); marca só a pior; hachura nunca vira zero.
- Só hex/rgba literais (`--p8-mensal` em rgba), nenhum `color-mix`. Nenhum texto do DOM abaixo de 12 px; nenhum par de texto abaixo de 4,5:1 nos dois temas (varredura de todos os nós de texto, transparências resolvidas, em 13 telas). Zero rolagem horizontal em 1440, 1280, 1100, 820 e 390, inclusive com título de 100+ caracteres, 7 dígitos e canal de 100 caracteres (hostil-390-claro.png).
- Estados de quadros (âmbar triângulo, vermelho octógono) com forma além da cor; texto em `--text`.

## 2. Achados

### C1. CORRIGE. Gráfico do vídeo a 390 px: texto de 7,7 px e pontos de 2,3 px (video-mensal / video-parado, 390, ambos os temas)
Evidência: `.p8-grafico` viewBox 640x210, largura renderizada 328 px => escala 0,5125; `font:15px` vira 7,7 px (eixo "9 mil", "14/03/2025", rótulo "mensal desde 05/12/2027"); raio dos pontos 4,5 vira 2,3 px, seis pontos cabem em ~30 px. A 1440 o SVG cresce até 18,6 px de texto e fica centralizado (max-height 260 => 792 px de 1042 de card). Quem lê no celular não lê o eixo.
Correção: viewBox mais estreito a 390 (ex.: gerar com W=330,H=190 quando `matchMedia('(max-width:820px)')`) mantendo `font:12px` e `r=4` em pixels reais; ou `<svg width="100%">` sem `preserveAspectRatio` escalando e texto em HTML sobreposto. Mínimo 12 px renderizados, ponto com raio >= 4 px. A 1440 trocar `max-height:260px` por `height:260px` e `preserveAspectRatio="none"` não: use viewBox 1040x260 para o gráfico ocupar o card.

### C2. CORRIGE. Texto de gabarito vazando na tela (canal, estado "Só 1 no arquivo" e "Arquivo não lido", 1440 e 390)
Evidência (peca8.js `contas`): `n = c.ar === null ? 'N' : c.ar`. Em "Arquivo não lido" a tela mostra "Aba Trocas: N trocas de vídeos que estão no arquivo". Em "Só 1 no arquivo": "1 trocas", "1 vídeos no arquivo ficaram", "1 mudanças". Também "Valor do meio...: 13 vídeos em leitura mensal ou no arquivo" some 12+1 sem plural.
Correção: (a) quando `ar === null`, cada linha da seção vira `aus('nm', 'Não foi possível contar os vídeos do arquivo.')` em hachura, uma só frase, nunca "N"; (b) função de plural: 1 troca / 1 vídeo no arquivo ficou fora / 1 mudança (texto de interface é do Logan; a regra de plural é de implementação, apliquei como defeito de dado).

### C3. CORRIGE. Esqueleto de carregamento com altura diferente da final (canal-carr, 1440 e 390)
Evidência (altura dos `.p8-sec`, 1440 / 390): contagem final 163 / 258 px, esqueleto 118 / 118; lista final 670 / 1089, esqueleto 625 / 877. A página pula 45 e 140 px na chegada do dado. Além disso, durante o carregamento a seção "O que ficou de fora das contas" já mostra números reais (40 trocas, 5 de 14...), contradizendo a contagem que ainda carrega, e o grupo mostra "No arquivo (40)" em mono.
Correção: esqueleto da contagem com `min-height` igual ao final (frase 2 linhas + barra 14 px + 3 linhas de legenda + linha do ⓘ; usar 163 px a 1440 e 258 px a 390 como `min-height` por breakpoint); linhas do esqueleto com a altura da linha real (76 px a 1440, 112 px a 390 hoje; a final tem 71/~140 com marca); seção das contas também em esqueleto; título do grupo sem número até a contagem chegar.

### C4. CORRIGE. "Mostrar mais 25": foco e anúncio (canal-mil, 1440 e 390)
Evidência: após o clique o foco permanece no botão e as 25 linhas entram sem `aria-live` (`document.querySelector('[aria-live],[role=status]:not([aria-busy])')` = nulo); no último lote o botão é removido e `document.activeElement` vira `BODY`. O primeiro "Mostrar mais 25" da lista principal (`data-p8="nada"`) não faz nada e não diz que não faz.
Correção: ao clicar, mover o foco para o link do primeiro vídeo novo (`tabindex` já nativo) e atualizar `<span role="status">Mostrando 50 de 150</span>` (hoje um `span` sem papel); no último lote focar o último link, nunca deixar cair em `body`. No botão morto, ou esconder no mockup, ou marcar "(só na mostra)".

### C5. CORRIGE. Frase digitada: o ⓘ promete o que o código recusa (quadro CONFIRMA e arquivo.html, 1440 e 390)
Evidência: ⓘ do quadro diz "A frase vale sem acento e com letras maiúsculas ou minúsculas". Teste: "Mandar Vídeos antigos..." libera (maiúscula ok); "mandar videos antigos..." mantém `aria-disabled="true"`. Há também o contrário a considerar: 04 L516 pede a frase exata.
Correção: ou normalizar acento no `input` (`value.normalize('NFD').replace(/[̀-ͯ]/g,'')` nos dois lados) ou apagar a frase do ⓘ. Recomendo normalizar (teclado sem acento no celular). O botão desabilitado usa `aria-disabled` com `aria-describedby` do status: manter; cuidado para o clique no desabilitado não fechar o diálogo (hoje não fecha: ok).

### C6. CORRIGE. Tabela da simulação a 390 px quebra o nome do canal letra a letra (estado SIM45 e ao apertar "Ver o que passaria", 390)
Evidência (est390e-0.png): coluna "Canal" fica com ~45 px: "Viage / m / Lenta", "Moch / ila e / Mapa"; cabeçalho "Se pass" cortado dentro da região rolável. `td.c{overflow-wrap:anywhere}` sem largura mínima.
Correção: `.p8-tab table{min-width:480px}` e `.p8-tab td.c,.p8-tab th:first-child{min-width:150px;overflow-wrap:break-word}` (a rolagem interna já existe e tem `tabindex=0` e `role=region`); ou, a 390, empilhar cada canal em duas linhas (nome acima, "8 vídeos, 416 registros" abaixo) e passar o aviso "40 ficam para o mês seguinte" para a segunda linha. A 390 o botão "Passar estes vídeos à leitura mensal" fica fora da rolagem: ok.

### S1. SUGESTÃO. Dado de exemplo contraditório no SIM45
Resumo diz "312 vídeos de 45 canais", a linha "Agora" logo abaixo diz "9 vídeos de 3 canais" (mesma frase do quadro ESP) e a tabela soma 197 em 7 linhas visíveis. Alinhar: a linha "Agora" usa a mesma contagem do resumo. A repetição resumo + linha "Agora" com a mesma frase (ESP, 1440) é redundante: manter só o resumo e deixar a linha com o botão.

### S2. SUGESTÃO. Pontilhado com dois significados
`ic('pont')` marca "9 vídeos têm mais de 2 anos" (espera o clique) e "Passar à leitura mensal sozinho: desligado" (estado), e é o mesmo do "ainda não existe" das réguas. Para "desligado" usar o `.m-c-zr`/traço cinza ("—" em círculo cheio de `--sunk`) ou só texto em negrito já presente. Hoje o texto resolve, então não bloqueia.

### S3. SUGESTÃO. Gráfico: datas nos pontos e "8 mil"
04 L486 pede cada leitura como ponto "com a data"; as datas estão só na tabela abaixo. Rotular ao menos o último ponto ("02/05") e ligar a tabela por `aria-describedby`. Na tabela, "8 mil" quebra a coluna tabular entre "7,9 mil" e "8,1 mil": usar "8,0 mil" (`toFixed(1)`). Eixo x só tem dois rótulos; incluir "05/12/2027" sob a linha do marco.

### S4. SUGESTÃO. Alvos
Entre os 44 px a 390: tudo passa, exceto o link "Canais" do breadcrumb (42 x 44; ampliar `padding-inline` para 44 de largura) e o link "arquivo.html" no texto de introdução do quadro de estados (17 px de altura; é link em parágrafo, aceitável, mas dá para pôr em linha própria). A 1440 os links de título têm 32 px e os `m-ibtn` 28 px: padrão do produto (peças 1 a 4 igual), sem achado.

### S5. SUGESTÃO. Bordas de campo e miniatura
Campo da frase digitada: borda `--border-strong` contra o fundo, 1,55:1 (escuro) e 1,69:1 (claro); abaixo de 3:1 exigido para o limite de componente. É token herdado do 18 e das peças aprovadas, então não corrijo só aqui: abrir um token `--input-line` (#8A7E67 claro-escuro a verificar) no lote, ou dar 2 px `--dim` ao campo do diálogo destrutivo. Miniatura vazia (`.p8-th`) é 1,12:1: é só espaço reservado, sem informação, aceito.

## 3. Tabela de medidas

| Item | Escuro | Claro | Limite |
|---|---|---|---|
| Segmento acompanhados (`--muted`/surface) | 6,18:1 | 7,13:1 | 3 |
| Segmento mensal, borda `--dim`/surface | 4,86:1 | 5,59:1 | 3 |
| Segmento mensal, preenchimento vs acompanhados | 2,93:1 | 3,75:1 | distinguir (forma ◐ + borda ajudam) |
| Segmento arquivo, borda `--dim` | 4,86:1 | 5,59:1 | 3 |
| Pontilhado do gráfico `--dim` | 4,86:1 | 5,59:1 | 3 |
| Zero medido `--im-zero` | 4,97:1 | 4,84:1 | 3 |
| Texto de todos os nós (13 telas) | mínimo >= 4,5:1, 0 falhas | idem | 4,5 |
| Texto do gráfico `--muted` | 6,18:1 | 7,13:1 | 4,5, mas renderiza 7,7 px a 390 (C1) |
| Borda do campo da frase | 1,55:1 | 1,69:1 | 3 (S5) |

| Item | 1440 | 390 |
|---|---|---|
| Fonte mínima (DOM) | 12 px | 12 px |
| Texto do SVG renderizado | 18,6 px | 7,7 px |
| Raio dos pontos mensais | 5,6 px | 2,3 px |
| Rolagem horizontal da página | 0 | 0 |
| Alvos < 44 px (fora do painel de mockup) | 38 (links 32, ⓘ 28) | 1 (breadcrumb 42 x 44) |
| Altura contagem: final / esqueleto | 163 / 118 | 258 / 118 |
| Altura lista: final / esqueleto | 670 / 625 | 1089 / 877 |
| Diálogo: altura / viewport | 567 / 844 | 757 / 844 (ações visíveis, 44 px) |
| Botão do diálogo e campo | 36 e 40 px | 44 e 44 px |
| Seção "Vídeos antigos" no Arquivo | 469 px | 825 px |

Valores soltos achados: nenhum hex fora dos tokens; `rgba(168,157,136,.4)` e `rgba(94,82,64,.4)` declarados como `--p8-mensal`, aceitos. `font:15px` literal no SVG e `13.5px`/`12.5px` de apoio já existem nas peças vizinhas.

## 4. Consistência com as peças 1 a 4
Régua de quatro etapas, `m-card`, `m-mes`, `.alerta`, `.vm`, selo "ajuste de mockup aprovado" e `M.quadro` reaproveitados; nada duplicado. Único componente novo legítimo: barra de três segmentos (`.p8-barra`), que deve nascer como componente de dado ("ProporcaoEmTres") se a peça 4 também a usar. A tabela de simulação (`.p8-tab`) é a mesma ideia do bloco "Canais removidos" da peça 3? Se for, reusar a classe de lá.

## 5. Para o Logan (uma linha cada)
- Os dois "Mostrar mais 25" (lista principal e grupo do arquivo) têm a mesma ação em contextos diferentes; o da lista principal não existe no plano 10.1 (só o do grupo).
- Seção "O que ficou de fora das contas" repete cinco frases que já aparecem nas outras telas; decidir se na tela do canal precisa ser lista de cinco ou uma frase com "Ver" para cada.

## 6. Não verifiquei
Leitor de tela (só inspeção de atributos), Opera real, aparelho de toque real, rede lenta, fontes web (offline), tamanho de toque do diálogo com teclado virtual aberto, `prefers-reduced-motion` (não há animação nova na peça).
