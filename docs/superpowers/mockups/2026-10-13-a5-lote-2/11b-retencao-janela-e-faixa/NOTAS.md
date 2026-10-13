# Mockup 11b: Retenção do vídeo próprio com seletor de janela e faixa do YouTube

Abrir: `cd docs/superpowers/mockups/2026-10-13-a5-lote-2/11b-retencao-janela-e-faixa && python3 -m http.server 47750 --bind 127.0.0.1` e `open http://127.0.0.1:47750/index.html`. A barra "Estados do mockup" (fechada, no topo, fora da tela simulada) troca entre 13 estados, as 3 janelas e o tema. Parâmetros: `?caso=` e `?janela=7|30|vida` e `?tema=claro`. Tudo é exemplo (vídeos e números inventados; hoje, no mockup, é 13/10/2026).

Achado do pedido: no spec isto **não é o mockup 11** (dado real, que não é portão: decisão 44, pergunta 39). É um **acréscimo novo ao bloco Retenção aprovado (mockup 6)**, liberado pela decisão 61. A tela do vídeo, o cabeçalho e a curva do mockup 6 ficam como estão; o acréscimo leva contorno tracejado verde-água e "+ novo".

## Os 13 estados (`?caso=`)

| Caso | O que mostra |
|---|---|
| `tipico` | vídeo de 44 dias, as 3 janelas lidas, vida inteira com 3 leituras e "como a curva mudou"; faixa "acima" (0,62) |
| `aberta` (`&janela=30`) | a janela de 30 dias ainda não fechou: "não medido", fecha em 25/10, barra "dia 18 de 30" |
| `short` | Short de 38 s: curva passa de 100% (eixo vai a 140%), nunca cruza 50%, comparação 0,97 (marca encostada em 1) |
| `antigo` (`&janela=7`) | vídeo de 2015: 7 e 30 dias fecharam antes da coleta (não voltam); vida inteira com uma só leitura |
| `serrilhada` | 41 views: curva balança, aviso "leia como indício", sem saídas nem trechos marcados |
| `vazia` | o YouTube não devolveu curva (poucas views), tentativa sem_dado_na_janela, nas 3 janelas |
| `sem-faixa` | curva veio, mas o YouTube não devolveu a comparação (métrica recusada) |
| `zero` | "0 trechos revistos" em caixa vazada; comparação 0,02 (marca encostada em 0) |
| `nao-coletada` | estado real de hoje: vida inteira sem nenhuma linha; 7 dias fechou antes da coleta; 30 dias aberta |
| `novo` | vídeo de ontem: as 3 janelas ainda não existem |
| `erro` | a última tentativa falhou, a leitura anterior continua na tela, com o aviso |
| `erro-sem` | a primeira tentativa falhou e não há leitura anterior |
| `leitura` | usuário só de leitura: não vê a curva (dado privado do YouTube Analytics); a tela diz isso |

Capturas: `shots/index-caso-<caso>[-janela-<j>]-<1440|390>-<escuro|claro>.png` (72, com os quatro cruzamentos; o par obrigatório é 1440 escuro e 390 claro; refeitas na rodada 2) e `shots/r2-*.png` (seção recortada: leituras abertas, zero, serrilhada, só leitura, erro sem leitura etc.). `shots/medidas.json`: rolagem horizontal 0, nenhuma fonte abaixo de 12 px, nenhum alvo abaixo de 44 px a 390 px, nas 72.

## Decisões de desenho e por quê

1. **O seletor é três cartões, não três abas.** Cada cartão traz a miniatura da curva da janela, "metade saiu aos m:ss" e a data da leitura. O dono compara as três janelas sem clicar; o clique só escolhe qual vai para o gráfico grande. Janela sem dado vira cartão com hachura rosa e o motivo (nunca um cartão apagado nem um zero).
2. **`role="radiogroup"` com `role="radio"`**, setas do teclado trocam, um só item no tab. A região da curva é `aria-live="polite"`. Padrão do lote 1 (mockup B) para a memória: escolha salva no navegador (`localStorage`, com try/catch) e a linha "Salvo neste navegador · Voltar ao padrão (vida inteira)" só aparece quando a escolha não é o padrão. Padrão = vida inteira (é o que o mockup 6 já mostra e a única janela que sempre existe).
3. **A faixa do YouTube é a forma memorável da tela:** régua de 0 a 1 em três zonas (▼ abaixo, ＝ média, ▲ acima), o 0,5 tracejado e a marca do vídeo com o valor. A zona do vídeo fica mais cheia; o símbolo e a palavra da zona também ficam em negrito, então lê em escala de cinza. O valor fica numa etiqueta presa à régua (`clamp` a meia largura de cada ponta), centrada no valor; perto de 0 e de 1 ela não centra mais, mas nunca sai do cartão, e a haste com a seta continua exatamente no valor. A zona onde o vídeo está tem 3:1 ou mais contra o cartão.
4. **A faixa não se confunde com o "% assistido contra o canal"** (mockup 5 e B): ela traz o selo "cálculo do YouTube", a régua de 0 a 1 e a frase "de vídeos de duração parecida"; o ⓘ diz em uma linha que não é o % assistido. Usei os mesmos ▲ ▼ ＝ e as mesmas cores de direção do lote 1 (não criei matiz). Ver pergunta 1.
5. **A frase-resumo vem ANTES do seletor** (no topo da seção, como no lote 1; uma frase, um `<span>`; muda com a janela escolhida e, em todo estado sem curva, é uma frase curta com a causa), com ícone de relógio (símbolo neutro: metade-saída não é direção). Abaixo dela, chips: "Leitura de dd/mm", views, e os avisos (curva passa de 100%, poucas views).
6. **"Como a curva mudou desde dd/mm"** só existe na vida inteira com duas leituras ou mais (7 e 30 dias são lidos uma vez e dizem isso numa linha). Três linhas, antes e agora e o que mudou com ▲ ▼ ＝, mais a primeira leitura tracejada por baixo da curva. As contas usam os números arredondados que aparecem, e "＝" é "até 2 pontos", como no % assistido. Nada de causa: o ⓘ diz "mostra o que mudou, não por quê". Todas as leituras ficam num `<details>`.
7. **Saídas e trechos revistos** continuam como no mockup 6, mas com os mesmos símbolos da curva (triângulo âmbar, retângulo claro). "0 trechos revistos" é uma medida (caixa vazada com 0), diferente de "não medido".
8. **Estados sem curva são um painel com faixa de hachura** à esquerda, o motivo em uma linha e, quando existe, a data em que passa a existir (e uma barra "dia 18 de 30" com contorno pontilhado, "ainda não existe"). Cada motivo vem da lista: ainda aberta, fechou antes da coleta (sem retroação), YouTube sem curva, nada coletado, erro.
9. **Erro** usa a família do erro na borda e no ícone e o texto em `--text`; diz o que falhou, o que continua valendo e quando tenta de novo ("você não precisa fazer nada").
10. **Só leitura** não fica mudo: os cartões ficam no lugar com cadeado ("Curva privada", "só quem edita vê") e o painel diz o que ele não vê, por quê e como pedir acesso.
11. **Curva** reaproveita as classes do mockup 6 (`cv-*`); o eixo cresce até 140% quando a curva passa de 100%; o rótulo "metade já saiu aqui" vira para a esquerda perto da borda. Tabela alternativa "Ver a curva em números" (11 pontos) para quem não lê o gráfico.
12. **Layout:** a 1440 a faixa é uma linha só (texto à esquerda, régua à direita), abaixo da frase; até 900 px empilha. A 390 px os cartões ficam em 3 colunas com rótulos curtos ("7 dias", "30 dias", "Vida toda") e a tabela "mudou" vira cartões de duas colunas.

## Frases da tela (texto exato)

| Onde | Texto |
|---|---|
| Rótulo do seletor | Janela da curva (ⓘ "Como a janela é contada") |
| Cartões (1440 / 390) | Primeiros 7 dias / 7 dias; Primeiros 30 dias / 30 dias; Vida inteira / Vida toda |
| Cartão com curva | Metade saiu aos m:ss; ou: Mais da metade fica até o fim; linha: Leitura de dd/mm |
| Cartão sem curva | pastilha "não medido" + uma de: fecha em dd/mm; fechou antes da coleta; sem curva do YouTube; falhou em dd/mm; primeira leitura em breve; ainda não coletada |
| Cartão privado | Curva privada; só quem edita vê |
| Lembrança | Salvo neste navegador · Voltar ao padrão (vida inteira) (a 390 px o link vai para a linha de baixo, sem o ponto) |
| Frase-resumo (NO TOPO, antes do seletor) | Nos primeiros 7 dias / Nos primeiros 30 dias / Na vida inteira do vídeo, metade das pessoas já saiu aos m:ss (N% do vídeo). Ou: ..., mais da metade das pessoas ficou até o fim. |
| Chips | Leitura de dd/mm; N views na janela; ▲ A curva passa de 100%: muita gente voltou e reviu o vídeo.; Só N views: leia como indício, não como medida. |
| Faixa | Acima / Na média / Abaixo de vídeos de duração parecida; selo: cálculo do YouTube; valor 0,62 numa régua de 0 a 1; zonas: ▼ abaixo, ＝ média, ▲ acima; marcas: 0, 0,5, 1 |
| Faixa com poucas views | linha extra na faixa: Só N views: leia como indício. |
| Faixa sem dado | Sem a comparação do YouTube. O YouTube não devolveu a comparação com vídeos de duração parecida nesta leitura. |
| ⓘ da faixa | cálculo do YouTube (relativeRetentionPerformance), 0,5 é o vídeo do meio, o corte abaixo/na média/acima é nosso (0,45 e 0,55), não é o % assistido, dado de exemplo |
| Como a curva mudou | Como a curva mudou desde dd/mm; colunas Leitura de dd/mm, Leitura de dd/mm, Mudou; linhas: Metade já saiu aos / Ainda assistem no fim / Comparação do YouTube |
| Mudou (textos) | +m:ss mais tarde / −m:ss mais cedo / quase igual (até 2 pontos do vídeo) / igual; +N pontos mais gente até o fim / menos gente até o fim / quase igual (até 2 pontos); subiu de faixa / desceu de faixa / mesma faixa |
| Histórico | Ver as N leituras (Leitura, Metade saiu aos, No fim, Comparação do YouTube; "mais recente") |
| Notas | Esta janela é buscada uma vez só, quando fecha: ela não muda depois. / Só há uma leitura (dd/mm). “Como a curva mudou” aparece a partir da segunda. |
| Listas | Maiores saídas; Trechos revistos; nenhuma saída marcada; nenhum trecho revisto; Com tão poucas views a curva balança: não marcamos maiores saídas nem trechos revistos. |
| Janela aberta | [Janela]: a janela ainda não fechou / Fecha em dd/mm (faltam N dias). A curva dessa janela é buscada uma vez, quando ela fecha. / dia N de M (o título "[Janela]: a janela ainda não fechou" é a frase do topo; o painel traz só a pastilha "não medido" e o texto) |
| Janela que não volta | [Janela]: a janela não existe para este vídeo / Ela fechou em dd/mm/aaaa, antes de começarmos a coletar. Não buscamos curvas do passado, então essa janela não volta. |
| YouTube sem curva | O YouTube não devolveu curva para este vídeo (poucas views) / Tentamos em dd/mm. Tentamos de novo quando o vídeo tiver views novas, no máximo uma vez por semana. (7 e 30 dias: Esta janela é buscada uma vez só.) |
| Não coletada | Ainda não coletamos esta curva / Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam. (texto do mockup 6) |
| Vídeo novo | Vídeo novo: a primeira leitura vem nos próximos dias / Quando ela chegar, esta seção mostra... |
| Erro com leitura | A última tentativa falhou em dd/mm. A tela mostra a leitura de dd/mm. Tentamos de novo em dd/mm; você não precisa fazer nada. |
| Erro sem leitura | Topo: A curva ainda não foi buscada. / Aviso vermelho: A primeira tentativa falhou em dd/mm. Tentamos de novo em dd/mm; você não precisa fazer nada. / Painel: Ainda não há leitura para mostrar. |
| Só leitura | Topo: Você não vê esta curva. / Painel: Ela vem do YouTube Analytics do canal e só quem edita o canal a vê. Os números públicos do vídeo, lá em cima, continuam à vista. / Para ver, peça acesso de edição a quem administra o canal. |
| ⓘ da janela | cada janela como é contada; só para vídeo cuja janela fecha depois da coleta começar; não buscamos o passado; salvo neste navegador; dado de exemplo |

## Dúvidas para o dono (com o padrão que adotei)

1. **Cor da faixa do YouTube.** A regra 14 diz "cor de direção só para direção". "Acima/na média/abaixo de vídeos parecidos" não é direção no tempo, mas o lote 1 (aprovado) já usa ▲ ▼ ＝ nas cores de direção para "acima/abaixo da faixa" na aba Retenção. **Adotei as mesmas cores e símbolos** e separei pela régua de 0 a 1 e pelo selo "cálculo do YouTube". Se preferir uma forma e cor próprias para o que é do YouTube, só o CSS da faixa muda.
2. **Cortes de "na média".** O spec não dá o número. **Adotei 0,45 a 0,55** (o décimo do meio da régua), sobre o valor com duas casas. É escolha nossa e está dita no ⓘ.
3. **A comparação muda com a janela?** O spec diz "relative como faixa" sem dizer de qual leitura. **Adotei uma comparação por leitura** (a faixa troca junto com a janela). Também não está definido como o valor do YouTube, que vem por ponto do vídeo, vira um número só por leitura (média? ponto final?): fica para o implementador confirmar com a API; o mockup mostra um valor por leitura.
4. **"Leitura de dd/mm" no lugar de "lida em dd/mm".** O pedido diz "lida em", mas a regra 8 proíbe "lido" na tela. Adotei "Leitura de". Se "lida em" for preferido, é troca de texto.
5. **"Poucas views" como não medido (hachura rosa).** A dívida B5 do lote 1 deixava sem decisão. Adotei: curva vazia do YouTube (sem_dado_na_janela) = hachura, porque "o dado não chegou"; curva serrilhada = a curva aparece com o aviso, sem hachura, sem saídas nem trechos. **Quantas views separam "serrilhada" de "boa"?** Usei 100 views do vídeo só para o exemplo; não é regra.
6. **7 e 30 dias com resposta vazia:** adotei "lida uma vez só" (sem nova tentativa), como a regra de coleta diz. Se o dono quiser nova tentativa, a frase muda.
7. **"Como a curva mudou" compara a primeira leitura com a mais recente.** Alternativa: com a anterior, ou escolher. Adotei a primeira (é o que o spec diz: "desde dd/mm").

## O que o implementador precisa saber

- Fonte da verdade do desenho: `11b.js` (marcação), `11b.css` (prefixo `rj-`), `11b-dados.js` (casos). Reaproveita sem mudar `a4.css`, `a4-comum.js`, `lote.css`, `lote.js` (cópias do lote 1 nesta pasta, congeladas). Peças novas: seletor `.rj-sel/.rj-c`, faixa `.rj-fx/.rj-rg`, tabela `.rj-mt`, painel `.rj-nmp`, banner `.rj-erro`, bloqueio `.rj-lock`.
- **A comparação do YouTube é classificada pelo valor arredondado a 2 casas** (o que o dono vê), nunca pelo valor cru. As diferenças de "mudou" também são sobre os números arredondados que aparecem.
- Janelas: `window_kind` = `primeiros_7_dias`, `primeiros_30_dias`, `vida`. Estado de cada cartão sai de: linha existe (lida), vencimento ainda no futuro (aberta, "fecha em" = publicação + 7 ou + 30 dias), vencimento antes do início da coleta (antes), tentativa `sem_dado_na_janela` (YouTube sem curva), nenhuma linha (não coletada), tentativa com falha (erro). "Faltam N dias" vem da mesma data e bate com a barra.
- "Zero" e "não medido" nunca se misturam: "0 trechos revistos" é caixa vazada; nunca curva reta em zero.
- Só leitura: o leitor da retenção deve respeitar o direito de ver dado privado; a tela não some, diz o que falta.
- Escolha de janela: `localStorage` com try/catch, chave própria, fallback para vida inteira; a URL (`?janela=`) vence o salvo.
- O seletor e a faixa **não estão no mockup 6 aprovado**: o plano de implementação (decisão 61) pode sair antes e esta tela entra depois como acréscimo; a seção atual (só vida inteira) continua válida como estado sem o seletor.
- Não verificado por mim: leitor de tela real, Safari/Opera, ordem completa do teclado. Rodada 1 do `revisor-ux-senior` feita (REVISAO-UX-r1.md); respostas abaixo; falta a rodada 2.
- Linha do tempo dos exemplos: a coleta das janelas começou em 15/08/2026 em todos os casos (`D.COLETA` em `11b-dados.js`), menos `nao-coletada`, que é o retrato do estado real de hoje, antes de a coleta ligar.

## Resposta à revisão r1

| Item | Resposta |
|---|---|
| B1 leituras sem rótulo a 390 px | Feito. Cada valor de "Ver as N leituras" traz o rótulo acima (Metade saiu aos, No fim, Comparação do YouTube), por `data-r` e `::before`; duas colunas e a comparação na linha de baixo. Captura `shots/r2-leituras-abertas-390-claro.png`. |
| B2 rótulo "0,02" fora do cartão | Feito. O rótulo saiu do marcador e é preso à régua com `clamp` (meia largura em cada ponta); a haste continua no valor. Medido a 390 e 360 px nos 10 estados com faixa: rótulo dentro de 33 a 357 (zero: 49 a 99; short: 291 a 341). Sem as classes `ini`/`fim`. |
| C1 frase-resumo abaixo do seletor | Feito, subi como no lote 1 (frase e chips antes do seletor). Estados sem curva também têm frase no topo (a causa em uma linha); o painel perdeu o título repetido e fica com a pastilha "não medido" e o texto. |
| C2 cartão "Vida inteira" desalinha a 390 px | Feito: rótulo curto "Vida toda" a 390 px; pastilha "não medido" em uma linha (12 px, 6 px de respiro). Medido a 390 e 360 px: linha "Metade saiu aos" a 66 / 66 / 66 px do topo em todos os estados testados. |
| C3 rosa em "curva privada" | Feito. Caixas do cadeado com borda `--dim` e fundo `--sunk`; nenhum rosa no estado só leitura. |
| C4 30 dias lido antes de fechar | Feito. O vídeo de poucas views passou a ser de 25/08: 7 dias lido em 05/09 e 30 dias lido em 28/09, depois de fecharem; vida inteira em 12/10. Escolhi a data de início da coleta (15/08/2026) e conferi os casos; o `nao-coletada` continua como o retrato de hoje, antes de a coleta ligar, e a nota do caso diz isso. |
| C5 palavra "lida" | Feito. Tela e ⓘ dizem "buscada" (uma vez, quando fecha / uma vez só / ainda não foi buscada). "Leitura de dd/mm" ficou. |
| C6 zona ativa da régua (3:1) | Feito. Só o estado `.on`: contraste medido contra o cartão, escuro 3,09 a 3,48 (tipico, zero), claro 3,18 a 3,24. As outras duas zonas ficaram como estavam (contexto). Valores diferentes dos sugeridos (claro com mais opacidade) porque os sugeridos davam 2,3 a 2,5:1 medidos. |
| Melhoria 1, veredito forte com 41 views | Feito: a faixa ganhou a linha "Só 41 views: leia como indício." quando são poucas views. |
| Melhoria 2 (âmbar) | Sem mudança, como o revisor indicou. |
| Melhoria 3, larguras | Feito: seletor, "+ novo", faixa, "como mudou", painéis, aviso e bloqueio em 900 px. |
| Melhoria 4, ⓘ da faixa | Feito (`justify-content:flex-start`): o ⓘ cola no fim do título. |
| Melhoria 5, aria-live | Feito. Saiu do detalhe; uma região `.sr` com `aria-live` anuncia só a frase-resumo a cada troca de janela. |
| Melhoria 6, nome do cartão | Feito: o círculo usa `content:"●" / ""`; o nome é só "Vida toda". |
| Melhoria 7, "Salvo neste navegador ·" sozinho | Feito: a 390 px o ponto some e o link vai para a linha de baixo (44 px de alvo). |
| Melhoria 8, erro sem leitura | Feito: o aviso diz "A primeira tentativa falhou" e o painel só "Ainda não há leitura para mostrar". |
| Melhoria 9, veredito antes da frase | Fica para o dono (decisão de ordem); a faixa continua depois do seletor. |

Reconferido nas 72 capturas refeitas (1440 e 390, escuro e claro): rolagem horizontal 0, nenhum texto abaixo de 12 px, nenhum alvo abaixo de 44 px a 390 px, zero `color-mix()`, console sem erro.
