# Notas do mockup 17a: Comparar canais com as medidas novas (13/10/2026)

Abrir: `cd` na pasta e `python3 -m http.server 47711 --bind 127.0.0.1`, depois `index.html?estado=<estado>` (`?tema=claro`, `?barra=0` recolhe a barra do mockup). A barra "Estados do mockup", fora da tela simulada, troca entre os 13 estados. Plano de partida: `PLANO.md`. Capturas: `shots/index-estado-<estado>-barra-0-1440-escuro.png` e `...-390-claro.png` (26 arquivos, 13 estados; rodada 2 do ajuste da revisão r1) e `shots/medidas.json` (rolagem horizontal 0, texto menor que 12 px 0, alvo menor que 44 px a 390 = 0, nos 24). `grep color-mix` só acha comentário "sem color-mix". Todo número é inventado e leva a marca "exemplo".

Estados: `tipico` (dois concorrentes, com dado, sem canal próprio) · `proprio` (seu canal × concorrente, com o cartão no fim) · `extremo` · `zero` · `naomedido` · `magro` (data de verdade, 13/10) · `fora` (um lado fora do ar) · `nichos` · `queda` (20/12/2026: a primeira data em que "Em queda" pode existir) · `2027` (a leitura justa existe) · `erro` · `vazio` · `leitura` (só leitura, número privado).

## 1. Decisões de desenho e por quê

1. **Uma direção de verdade, duas de apoio.** M3(a), canal inteiro em 28 dias, é a principal hoje: única com símbolo em quadrado cheio, percentual em destaque, régua do nicho e a etiqueta "leitura principal". (b) e (c) ficam sob "Para conferir (leituras de apoio, não são vereditos)", com o mesmo símbolo e a mesma cor, mas só em contorno, texto menor e sem régua. Motivo: três setas iguais virariam três vereditos; assim a hierarquia é de forma, e a cor continua a mesma (cor estável por significado).
2. **A frase do topo diz se as três concordam.** Calculada dos mesmos números: "As outras leituras concordam" ou "divergem: os vídeos novos estão descendo (pode ser só idade)". O dono lê uma frase e sabe se precisa olhar o apoio.
3. **(c) hoje é "ainda não existe", não "não medido".** Contorno pontilhado (a forma de "ainda não existe" do lote 1), nunca a hachura rosa: não é dado que falhou, é dado que só nasce em abril de 2027. A data vai uma vez só na coluna Diferença, em vez de repetida nas duas células.
3b. **Estado "2027":** (c) sobe para principal e (a) desce para o apoio, trocando de lugar sem mudar de forma. Mostra a promessa do spec ("(a) hoje, (c) quando existir").
4. **Marca "a contagem de views do YouTube mudou neste período"** (regra f do spec 5) aparece em (a) enquanto a janela de 56 dias cruza 24/08/2026 (hoje, 13/10) e em (b) enquanto a de 180 dias cruza (em 13/11 também). Triângulo âmbar mais texto, sem ser direção.
5. **Nichos diferentes: duas réguas curtas, uma por lado, cada uma no seu nicho** ("Viagem, 13 canais" e "Culinária, 13 canais"), e a frase do topo diz "a régua ordena cada canal dentro do próprio nicho, não diz quem é melhor". A coluna Diferença continua, porque é aritmética, mas não há uma régua única que pareça pôr um nicho acima do outro.
6. **Fora da escala:** a régua de direção vai de −60% a +60%; valor fora (+217%, −63%) encosta na ponta com ◀ ou ▶ e o texto alternativo diz o valor. Não estica a escala (estragaria a leitura dos outros 12 canais).
7. **M4 em casas, não em barra.** Uma casa por vídeo: cheia na cor do lado (acerto, passou de 2× a mediana), riscada (fracasso, metade ou menos), vazia (no meio). Escrito sempre "3 de 12"; o percentual só aparece com 10 ou mais. Cor do lado, não verde: acerto não é direção. Sem "×" entre os lados: o spec diz que M4 mede regularidade, não tamanho; a coluna Diferença diz isso em uma linha.
8. **M7 rotula a idade da leitura em cada lado**: "aos 30 dias" (chip contornado com ✓) ou "total de hoje" (chip tracejado com relógio), e "só curtidas: comentários desligados" (chip âmbar). Se os dois lados têm leituras diferentes, a coluna Diferença diz "≠ Leituras diferentes: não dá para dizer qual é maior" e não calcula "×". É o ponto onde o sistema mais falharia em verde.
9. **M1 ganha "Primeiras 24 horas"** (N=1) acima de 7 e 30 dias, com barras pareadas na mesma escala (régua de relance) e o motivo "só vídeos publicados depois de 17/10". Data do deploy da E2 é exemplo (ver dúvida 3).
10. **M8 no cartão de cada lado**, ao lado do nome: pastilha com forma própria (● ativo, ⏸ parado, ▼ em queda, ⊗ fora do ar) e uma linha de apoio ("último longo há 6 dias"). Parado e em queda em âmbar, fora do ar na família do erro (borda e ícone; o texto fica em `--text`). "Queda sustentada: medida a partir de 14/12" vira linha com hachura abaixo da pastilha de todo canal ativo ou parado antes de 14/12/2026, em vez de silêncio; "Em queda" só aparece no estado `queda` (20/12/2026).
11. **"praticamente igual" = ±10%**, com ＝ e um ⓘ colado à frase que abre o limiar; o ⓘ do cabeçalho "Diferença" e o do título "Número a número" dizem o mesmo. O exemplo do dono (8.1.5): na linha "Longos publicados", 13 contra 12 sai "praticamente iguais" e o ⓘ ao lado diz que **a contagem de 90 dias não mede frequência**.
12. **Zero medido × não medido.** Contagem que veio zero = caixa vazada com 0 (`zbox`: "0 longos contra 8", "0 de 12"). Mediana de "nenhum vídeo" continua **não medido** e diz o motivo ("nenhum longo publicado desde 17/10"); nunca um 0 no lugar. O estado `zero` mostra os dois lado a lado.
13. **"Só o seu canal mede" no fim, depois de "Número a número"** (decisão do dono, 12/10). Com seu canal: o cartão aprovado. Sem canal próprio nos dois lados: uma linha quieta diz por que não há cartão (não some em silêncio). Só leitura: o cartão vira "Você não vê estes números", cadeado em cada linha ("sem permissão para ver"), e a saída ("peça ao dono do canal o acesso de editor"). Cadeado em contorno neutro: nem hachura (não é dado ausente) nem zero.
14. **Erro** tem forma própria (borda e ícone na família do erro, texto em `--text`), diferente da hachura: "não carregou" não é "não medido". O lado que carregou continua inteiro e a frase do topo diz.
15. **Vazio**: o lado B vira cartão tracejado com "Escolher canal" e a tabela vira um esqueleto pontilhado dos cinco blocos, para o dono ver o que virá.
16. Ordem dos blocos: Direção · Desempenho · Tamanho · Primeiros dias · Acerto e reação do público · (cartão). Direção continua em cima porque é a pergunta de 3 segundos.

## 2. Tabela de frases da tela (texto exato)

| Onde | Texto |
|---|---|
| Título | Comparar canais |
| Subtítulo | Dois canais, lado a lado. O que importa aqui é a direção de cada um, não quem é maior. |
| Faixa de exemplo | exemplo · Números inventados. A tela como fica em 13/11/2026, um mês depois de a coleta nova entrar no ar. (magro: "A tela com a data de hoje, 13/10/2026, o caso real por meses: quase tudo ainda sem medir."; 2027: "A tela como fica em 20/04/2027, quando a leitura justa existe.") |
| Pastilha M8 | Ativo / Parado / Em queda (só no estado `queda`, 20/12/2026) / Fora do ar / não carregou (erro), mais: "último longo há N dias" · "há N dias sem longo novo" (Dale Philip em `zero`: há 95 dias, para fechar com "0 longos em 90 dias") · "3 janelas de 28 dias seguidas" · "desde 02/11; último registro em 01/11" |
| Queda não medida | queda sustentada: medida a partir de 14/12 (em TODO canal ativo ou parado antes de 14/12/2026); a 390 px a linha some do cartão e fica só no ⓘ da pastilha |
| Leitura rápida (por lado) | "{Nome} está **subindo**: +28% de views no canal inteiro, 28 dias contra 28. Outras leituras: ✓ concordam" / "≈ concordam em parte (vídeos novos (views de hoje): estável)" (menos de 10 pontos de distância) / "≠ divergem (vídeos novos de hoje: descendo; pode ser só idade)" (nomes curtos: canal inteiro, vídeos novos de hoje, vídeos novos na mesma idade) / "ainda sem leitura de apoio" / "{Nome}: sem direção medida ({motivo})." / "{Nome}: os números não carregaram. Nada foi medido agora." O estado do canal (parado, em queda, fora do ar) não se repete aqui: fica só na pastilha. |
| Leitura rápida (contexto) | Só de contexto: {maior} tem 6,1× os inscritos de {menor}. O tamanho não entra na direção. · (erro) Tamanho: sem comparação, os inscritos de {Nome} não carregaram. (símbolo de erro) · (nichos) Nichos diferentes (Viagem e Culinária): a régua ordena cada canal dentro do próprio nicho, não diz quem é melhor. |
| Grupo Direção | Direção: cada canal contra ele mesmo · "leitura principal: canal inteiro, 17/10 a 13/11 contra 19/09 a 16/10" (2027: "vídeos novos na mesma idade, 90 dias contra 90") |
| Linha principal | etiqueta neutra "◆ leitura principal" (borda e texto neutros, sem o laranja de "seu canal") + Canal inteiro (ou Vídeos novos, mesma idade) · "views ganhas nos últimos 28 dias contra os 28 anteriores" · célula: "▲ subindo +28%" + "1,4 mi contra 1,1 mi views ganhas" |
| Subtítulo do apoio | Para conferir (leituras de apoio, não são vereditos) |
| Apoio b | Vídeos novos, views de hoje · "mediana dos longos publicados em 90 dias contra os 90 anteriores. Descer pode ser só idade" |
| Apoio c | Vídeos novos, mesma idade · "views aos 30 dias de cada vídeo, sem favorecer o vídeo mais velho" · célula "ainda não existe" · coluna Diferença "Existe a partir de abril de 2027, com 180 dias de registro." |
| Marca de contagem | a contagem de views do YouTube mudou neste período |
| Longos publicados | "nos últimos 90 dias contra os 90 anteriores; é uma contagem, não a frequência" · "13 longos contra 11" · "0 longos contra 8" · direção só pela regra de ±10% (3 contra 4 = ▼ −25%; 8 contra 9 = ▼ −11%) · Diferença com janelas diferentes: "+63% de longos publicados (até 01/11)" · "praticamente iguais" |
| Grupo Desempenho | Desempenho dos vídeos · "longos publicados nos últimos 90 dias" · linhas: Mediana de views dos longos; Views por dia nos longos; Views por dia por mil inscritos |
| Células de número | "mediana de 13 longos publicados em 90 dias" · "5º de 14 no nicho" · (nichos) "4º de 13 no nicho Viagem" · "até 01/11" (fora do ar) |
| Régua | "No nicho / do menor ao maior" · "14 canais" · "Viagem, 13 canais" · "sem traço de {Nome}" · ⓘ "A régua do nicho" (explica a escala de proporção, antes escrita "escala log" na tela) · eixo "descendo, estável, subindo" |
| Grupo Tamanho | Tamanho do canal · Inscritos · "contagem pública, arredondada pelo YouTube" |
| Grupo Primeiros dias | Views nos primeiros dias de cada vídeo · "compara vídeos na mesma idade, sem favorecer o vídeo mais velho" · linhas: Primeiras 24 horas ("só vídeos publicados depois de 17/10"), Primeiros 7 dias, Primeiros 30 dias · "mesma escala nos dois lados" |
| Faixa do magro | **Nada fechou ainda:** o primeiro vídeo com 30 dias fecha em 02/11. (uma linha; o resto está no ⓘ do bloco) |
| Grupo Acerto | Acerto e reação do público · legenda: passou de 2× a mediana · no meio · metade da mediana ou menos |
| Taxa de acerto | "longos publicados em 90 dias, com 7 dias ou mais, que passaram de 2× a mediana do próprio canal" · "3 de 12" (+ "25%" só com 10 ou mais) · "passaram de 2× a mediana do próprio canal" · "ficaram na metade ou menos: 2 de 12" · Diferença: "Cada canal contra a própria mediana: mede regularidade, não tamanho." |
| Reação | Curtidas e comentários por view · "mediana dos longos com 100 views ou mais, na idade de 30 dias" · chips: "aos 30 dias" / "total de hoje" / "só curtidas: comentários desligados" · "mediana de 5 longos" · Diferença: "Leituras diferentes: não dá para dizer qual é maior." |
| Rodapé da tabela | Maior não quer dizer melhor: são canais de tamanhos diferentes. |
| Diferença | "{Nome}: 24× a mediana de views de {Outro}" (≥ 2×) · "{Nome}: +75% de {noun}" · "praticamente igual" |
| Motivos de "não medido" usados | "menos de 56 dias de registro: tem 32 e fecha em 07/12" · "2 longos nos últimos 90 dias; precisa de 3" (e "…nos 90 anteriores") · "só 3 longos com 7 dias ou mais; precisa de 5" · "publicado antes de 17/10: as primeiras horas não foram contadas" (depois de 17/10) · "as primeiras horas passam a ser contadas em 17/10" (magro, em 13/10) · "descoberto com mais de 24 h depois de publicado" · "o primeiro fecha em 22/11" · "nenhum longo com 30 dias de contagem" · "nenhum longo publicado desde 17/10" · "curtidas ocultas e comentários desligados" · "fora do ar: falta o registro de hoje" |
| "Ainda não existe" | ainda não existe |
| Erro | no cartão do lado que não carregou: só o nome e a pastilha "não carregou" (nem inscritos, nem longos acompanhados, nem nicho) e uma só vez por célula (sem segunda linha); aviso: "Os números de {Nome} não carregaram." / "O lado de {Nome} está inteiro. Tente de novo; se repetir, o problema é nosso, não do canal." / botão "Tentar de novo" |
| Vazio | Escolher canal · "Escolha o segundo canal" · "O Observatório acompanha 14 canais de Viagem e 9 de outros nichos." · cinco títulos de bloco em esqueleto pontilhado |
| Sem canal próprio | Nenhum dos dois é o seu canal. Impressões, taxa de clique e % assistido só aparecem quando um dos lados é o seu, porque o YouTube só as entrega ao dono. |
| Cartão | Só o seu canal mede · "Impressões, taxa de clique e % assistido só chegam ao dono do canal. {Nome} não tem esses números aqui porque o YouTube não os entrega, **não porque sejam zero**." (aprovado, igual ao mockup 9) |
| Só leitura | "Você não vê estes números. Impressões, taxa de clique e % assistido de {Nome} são privados do canal, e a sua conta só lê o que é público." · linhas "sem permissão para ver" · "Para ver, peça ao dono do canal o acesso de editor. O resto desta tela continua igual para você." |
| ⓘ | `infoTres` (as três leituras), `infoIgual` (±10%), `infoFreq` (longos publicados não é frequência), `infoEstado` (M8), `infoAcerto` (M4), `infoReacao` (M7), `infoDias` (M1 com 24 horas), `infoSo` (aprovado). Todos com "cálculo do Observatório sobre dados públicos do YouTube", base, janela e conta. |

## 3. Dúvidas para o dono (com o padrão adotado)

1. **Quando (c) vira a principal?** Adotei: quando existir para os dois lados (3 longos fechados em cada período de 90 dias), ela sobe e (a) desce; se existir só para um lado, (a) continua principal para os dois, para as linhas não ficarem com leituras principais diferentes.
2. **"Parado" é o ＝ da direção ou o estado M8?** (NC já aberta no spec.) Adotei como o lote 1: ＝ neutro na direção, e âmbar só no estado M8 "parado" (pastilha ⏸) e "em queda" (▼). Os dois aparecem na tela e o dono decide.
3. **Data do deploy da E2** que libera as primeiras 24 horas: usei 17/10/2026 como exemplo, em três frases. Precisa da data real antes de implementar.
4. **Nichos diferentes: manter a coluna Diferença?** Adotei manter (é só aritmética, e o ⓘ avisa), com a régua por nicho. Alternativa: esconder a Diferença quando os nichos diferem.
5. **Canal fora do ar:** adotei direção (a) "não medido" (falta o registro da borda) e as outras linhas com "até 01/11", como manda a regra (g). Alternativa: apagar todos os números.
6. **Dois lados com idades diferentes de M7:** adotei não calcular "×" e dizer "Leituras diferentes". Alternativa: esconder o lado "total de hoje" até as duas leituras existirem.
7. **Percentual de M4 com 10 ou mais** (regra do spec): está na tela; confirmar que o dono quer o percentual cinza ao lado de "3 de 12" e não só a contagem.
8. **"Queda sustentada: medida a partir de 14/12" vira linha própria em TODO cartão** (canal ativo ou parado) enquanto a data for anterior a 14/12/2026, não só em dois canais. Se for ruído, vai só para o ⓘ.
9. **Longos publicados: piso de 2 longos?** Hoje vale só ±10%, como as outras direções (3 contra 4 já é ▼). Se o dono quiser um piso por causa de contagem pequena, ele precisa dizer, e o piso entra no ⓘ "Longos publicados não é frequência" e aqui.

## 4. O que o implementador precisa saber

- **Aproveita da produção:** `_comparar/` já tem a tabela do mockup 9; o que muda é (i) a linha principal e as duas de apoio no grupo Direção, (ii) a pastilha M8 no cartão de cada lado, (iii) as linhas M1 N=1, M4 e M7, (iv) o cartão "Só o seu canal mede" passar para depois da tabela, (v) os estados erro, vazio e só leitura.
- **Toda medida chega como `{ estado: 'medido', valor, n, janela }` ou `{ estado: 'nao_medido', motivo, desde? }`** (spec 5, regra a). A tela não decide nada: motivo e data de "fecha em" vêm da medida. O mockup deriva "não medido" na hora só porque não tem backend; os textos da tabela da seção 2 são os contratos.
- **O componente de direção tem duas variantes** (cheio e contorno), a mesma tabela de cor: verde ▲, âmbar ▼, neutro ＝ (item de aceite 241). O símbolo em contorno só muda a forma, nunca a cor. Teste com os três estados, "não medido" e "ainda não existe".
- **"Ainda não existe" ≠ "não medido"** (pontilhado × hachura): são dois tipos de retorno diferentes na API; (c) antes de abril de 2027 deve voltar como o primeiro.
- **Marca de 24/08/2026:** calcular pelas datas da janela da medida (`inicio <= 2026-08-24 <= fim`), não pela data de hoje.
- **A régua** usa 5% a 95% da largura (a marca A, de 24 px, e a seta de "fora da escala" não podem passar da borda; a 390 px passaram 6 px e geravam rolagem horizontal até isso ser corrigido). Direção: −60% a +60%, as demais em escala log.
- **Cuidado com nomes de classe:** `.fora` e `.dir` já existem em `a4.css` (a barra de referência do mockup e outra); não reaproveite, o fundo preto aparece.
- **A 390 px:** a tabela vira cartões (regra do mockup 9, 860 px); alvos de 44 px nos ⓘ (já em `a4.css`); a pastilha M8 não é alvo de toque (não é botão).
- **Fora do que foi desenhado:** duração mediana, vídeos acima de 2× em 90 dias e trocas em 30 dias (linhas do mockup 9 que não mudam), e o botão "Perguntar a uma IA" (mockup 22). Os nomes dos canais seguem a convenção do lote; os números são todos inventados e não vêm de produção.
- **Verificação que não foi feita:** leitor de tela, Safari/Opera, ordem de teclado completa e contraste medido no navegador (só o script de rolagem, fonte e alvo rodou). Fica para o `revisor-ux-senior`.

## 5. Resposta à revisão r1 (13/10/2026)

Estado novo `queda` (20/12/2026) e 26 capturas refeitas (1440 escuro e 390 claro, 13 estados); medidas.json: rolagem 0, texto menor que 12 px 0 e alvo menor que 44 px a 390 = 0 nos 26. Conferi abrindo: tipico, queda, proprio, erro, fora, magro (1440 e 390 onde mudou).

| Item | Resposta |
|---|---|
| 1. "Em queda" em 13/11 | Aceito. Nômade Raiz passa a Ativo em `tipico` e `erro`; "Em queda · 3 janelas de 28 dias seguidas" só existe no estado novo `queda` (20/12/2026, janela de 112 dias a partir de 30/08, depois da mudança de 24/08). A Leitura rápida não repete o estado. |
| 2. "＝ estável" para −25% e −11% | Aceito. Longos publicados usa só ±10% (`kOf`), a mesma regra de todas as direções: 3 contra 4 e 8 contra 9 viram ▼ âmbar. O ⓘ "Longos publicados não é frequência" diz a regra. Piso de 2 longos fica como dúvida 9 para o dono, não escondido no código. |
| 3. Faixa de prosa no magro | Aceito. Uma linha: "Nada fechou ainda: o primeiro vídeo com 30 dias fecha em 02/11." Sem "contagem diária" na tela. |
| 4. Jargão | Aceito. "contagem diária" na tela vira "registro"; "viés de idade" e "viés de quem é mais velho" viram "sem favorecer o vídeo mais velho"; "escala log" sai da tela e vai para um ⓘ novo "A régua do nicho" no cabeçalho "No nicho". Termos exatos só dentro dos ⓘ. |
| 5. Etiqueta em laranja | Aceito. "◆ leitura principal" com borda `--dim` e texto `--text`; o laranja fica só para "seu canal", ação e foco (visível lado a lado no estado `proprio`). |
| 6. Três frases por lado | Aceito. Uma frase de direção ("+28% de views no canal inteiro, 28 dias contra 28") mais "Outras leituras: ✓ concordam", "≈ concordam em parte" ou "≠ divergem" (com a leitura que diverge entre parênteses). Nada de estado do canal na frase. |
| 7. Erro afirma estado | Aceito. No lado que não carregou a pastilha vira "não carregou" (família do erro) e some a linha de apoio e a linha de queda. |
| 8. Resposta abaixo da primeira tela a 390 px | Aceito pela segunda alternativa (cartões compactos): a 640 px ou menos o A/B vai para o canto, some "longos acompanhados", o ⓘ fica na linha da pastilha e o apoio desce para a linha de baixo. Leitura rápida a 653 px do topo em `tipico` (era 747); em `erro` fica a 809 porque o aviso de erro (a notícia principal) vem antes dela. Não reordenei o DOM por CSS para não separar a ordem visual da ordem de leitura. |
| Barra de "não medido" com comprimento | Feito: só a hachura e o texto "não medido", sem barra. |
| "divergem" para +16% contra +8% | Feito: "≈ concordam em parte" quando a distância é de menos de 10 pontos. |
| 14 repetições de "tente de novo" | Feito: uma pastilha "não carregou" por célula, sem segunda linha. |
| "o" quase invisível em "sem direção medida" | Feito: círculo em SVG de 2 px na cor `--nm`. |
| Queda "ainda sem como medir" só em 2 canais | Feito de forma consistente: "queda sustentada: medida a partir de 14/12" em todo cartão ativo ou parado antes de 14/12/2026 (dúvida 8 atualizada). |
| Diferença entre janelas diferentes | Feito: "+63% de longos publicados (até 01/11)". |
| Motivos com data futura no magro | Feito: "as primeiras horas passam a ser contadas em 17/10". |
| Hierarquia de títulos | Feito: "Leitura rápida" é `h2`; o título do popover deixa de ser `h3` (parágrafo com `aria-label` no popover). Sem leitor de tela para confirmar. |
| Esqueleto do vazio estreito | Feito: usa a largura toda, como a tabela real. |
| Alvo do ⓘ a 1440 (28 px) | Mantido, padrão aprovado do lote 1; a 390 todos medem 44 px. |

Não discordei de nenhum item. Fica para a rodada 2: leitor de tela, Safari/Opera e Firefox.

## 6. Resposta à revisão r2 (13/10/2026)

Refeitas as capturas dos 13 estados (1440 escuro e 390 claro, 26 arquivos mais `r2-resposta-magro-faixa-390-claro.png`); medidas.json em 52 páginas (4 cruzamentos): rolagem 0, texto menor que 12 px 0, alvo menor que 44 px a 390 = 0. Abri `erro` (390 claro) e `zero` (1440 escuro) e medi apoio x pastilha, Leitura rápida e faixa do magro no navegador. Nenhum item discordado.

| Item | Resposta |
|---|---|
| Bloqueio 1: `erro` ainda dá inscritos do lado que não carregou | Aceito. O cartão do lado com erro tem só o nome e a pastilha "não carregou" (some "2,1 mi inscritos", "50 longos acompanhados" e o nicho). A 3ª linha da Leitura rápida deixa de dizer "6,1×" e vira, com o símbolo de erro: "Tamanho: sem comparação, os inscritos de Nômade Raiz não carregaram." O `aria-label` do lado diz "não carregou". Tabela e cartão agora dizem a mesma coisa. |
| Bloqueio 2: `zero` com "parado há 61 dias" e "0 longos em 90 dias" | Aceito. Dale Philip passa a "há 95 dias sem longo novo" (acima de 90, continua Parado pela regra de mais de 28 dias). Os dois números fecham. |
| Bloqueio 3: apoio invade a pastilha a 390 px | Aceito. O recuo negativo de -4 px virou `margin-top:6px`. Medido nos 6 estados que reconferi: pastilha termina em 439,3 e o apoio começa em 445,3 (folga de 6 px; antes -4 px). |
| Melhoria 1: segunda frase da Leitura rápida fora da primeira tela | Feito. A 390 somem do cartão a linha de inscritos (está na tabela) e "queda sustentada: medida a partir de 14/12" (está no ⓘ da pastilha). Título da Leitura rápida a 648 px (era 666); a frase de A termina em 739 e a de B em 810 px, as duas dentro da primeira tela de 844 px (a meta de ~750 só a primeira cumpre; não cortei mais para não esvaziar o cartão). Em `erro` o título fica a 810 porque o aviso de erro vem antes. |
| Melhoria 2: lado A e "descendo" parecidos no tema claro | Registrado, sem mexer: a letra A e o ▼ diferem por forma e vêm do lote 1 aprovado; decisão do dono se quiser separar as duas cores (dúvida 10 abaixo). |
| Melhoria 3: faixa "Nada fechou ainda" | Feito. Ícone e texto na mesma linha a 390 (`flex-wrap:nowrap`, medido: ícone e texto a 3 px de diferença) e a faixa passa a ter a largura da tabela (1176 e 1176 px a 1440; 358 e 358 a 390). |
| Melhoria 4: "subindo)" órfão no `2027` | Feito. Nomes curtos nos parênteses: "(canal inteiro: estável; vídeos novos de hoje: subindo)". |
| Melhorias 5 e 6: alvo do ⓘ a 1440 e barra do mockup | Mantidos como a r2 recomenda (padrão aprovado do lote 1; barra fora da tela simulada). |

Dúvida 10 para o dono: separar a cor do lado A da cor de "descendo" no tema claro? Hoje só a forma distingue (letra x quadrado ▼).
