# Fase de manutenção de dados (NAS e forja): spec, parte 04: peças de tela

> Parte do spec de 13/10/2026. Índice e marcas de fato: [`00-indice.md`](00-indice.md).

## 14. Telas

**Este spec não desenha mockup.** Ele lista as peças novas, o que cada uma tem de dizer em cada estado, a forma visual mínima que o desenho tem de respeitar e quais mockups aprovados da A5 elas tocam. O desenho passa pela skill de frontend e pelo revisor de UX na fase seguinte, e **nenhuma linha de código de tela nasce antes da aprovação visual do dono**. Valem as regras de tela já fixadas por ele: frase-resumo no topo, régua ou barra, cor estável (inclusive para "não medido"), método no botão de informação (ⓘ), nenhum bloco só de prosa nem só de uma cor.

**Como ler as tabelas desta seção.** A coluna da esquerda é o **nome interno do estado** e nunca vai à tela. A coluna "o que a tela diz" é o texto que o dono lê; ela já segue o vocabulário abaixo, e o texto final é do mockup, revisto pelo revisor de UX.

**Vocabulário fixado** (o mesmo nome para a mesma coisa, em todas as peças):

| Na tela | Quer dizer | Nunca se usa para |
|---|---|---|
| **cópia** | a cópia mensal de um mês fechado para o NAS e para o B2 | a remoção de canal |
| **exportação** | o pacote de um canal que está sendo removido (mockup 18 e peça 7) | a cópia mensal |
| **verificado** | o que a forja faz sozinha, duas vezes por dia ("No NAS, verificado hoje às 06:17") | a conferência do dono |
| **conferido por você** | a conferência do B2, feita pelo dono no Mac ("No B2, conferido por você em 02/10") | o que é automático |
| **recuperação testada** | o ensaio de restauração ("Recuperação testada em 05/12") | n/a |
| **sem registro neste mês** | mês em que o banco não tinha nenhum registro, conferido ("Sem registro neste mês. Conferimos em dd/mm: o banco não tinha nenhum registro de outubro") | uma hora ou um dia sem leitura, que os mockups 13, 15 e 18 já chamam de "sem leitura" |
| **registros** | linhas de tabela, como o mockup 18 já diz ("118.402 registros") | n/a |
| **a casa** | a forja e o NAS, juntos, em toda peça. O ⓘ diz: "a casa é a forja e o NAS; o site não sabe qual dos dois está parado" | n/a |
| **no arquivo** | o que saiu do banco online e está no NAS e no B2 | "não medido" |
| **cópia na nuvem (Backblaze B2)** | na primeira vez em cada peça; depois, "B2" | n/a |

**Os três tipos de dado**, com o nome que o dono lê em toda linha (os nomes internos `horaria`, `serie` e `texto` não vão à tela): **Leitura de hora em hora**; **Views por dia**; **Comentários e dados antigos do YouTube**. O ⓘ de cada um diz o que ele guarda.

**Palavras que não aparecem na tela**, fora do ⓘ: "lote", "unidade", "selar", "selado", "selagem", "partição", "cadeia", "atestação", "hash", "ensaio", "restauração", "divergente", "ambiente", "tabela", "linhas" (use "registros") e "MB". É o item de aceite 38, com teste que varre os arquivos de texto das telas.

**Quem vê.**

- **Todo mundo que vê a tela:** a peça 1 (o "desde dd/mm" e o "no arquivo"), porque faz parte do número. O texto é o mesmo para todos e não traz nome de máquina, de arquivo nem de comando. Quem só lê vê a peça 1 e, onde haveria a porta para o pedido, a frase "No arquivo desde mm/aaaa."
- **Só quem edita o site:** a porta para o pedido (peça 6), as peças 2, 4 e 7 e o aviso de limite (peça 5).
- **Só quem administra o site:** os botões que tiram mês, liberam o espaço, trazem de volta e ligam o automático, e o grupo de dado de teste.

**Três ausências que valem em todas as peças, com forma própria, e que nunca viram zero, vazio ou verde:**

- **"Não respondeu":** a casa não deu sinal dentro do prazo. A tela diz desde quando.
- **"Não medido":** o site não conseguiu ler o próprio registro. A tela diz o que não foi lido.
- **"No arquivo":** o dado existe, saiu do banco online e está no NAS e no B2. Nunca se confunde com as duas anteriores.

**A pergunta de quem abre cada peça** (o que o mockup tem de responder no primeiro olhar):

| Peça | Pergunta de quem abre | O que tem de ser o mais forte da tela |
|---|---|---|
| 1 ("desde" e "no arquivo") | "Este número está completo ou falta um pedaço que saiu do banco?" | A frase "desde dd/mm" junto do número, e o trecho que está no arquivo com forma própria no eixo |
| 2 (página do arquivo) | "Algum mês precisa de mim agora, e quando o próximo pode sair?" | A linha que precisa do dono, acima de qualquer mês saudável |
| 3 (tirar o mês) | "Posso tirar este mês? Se não, o que falta? Se sim, o que eu perco?" | A condição que falta; ou, habilitado, a frase do que muda nas telas |
| 4 (automático) | "Está ligado? Vai tirar algo sem eu ver? Parou por quê?" | O estado ligado, desligado ou parou, com data |
| 5 (aviso de limite) | "O banco vai ficar sem espaço antes do alívio chegar?" | O percentual de hoje e se o alívio chega antes do aperto |
| 6 (período longo) | "Consigo ver o passado de um canal, e vai demorar?" | A cobertura por mês: quais vieram, quais faltam |
| 7 (fila "Saíram do YouTube") | "Falta eu rodar algum comando?" | A contagem de pendências e a idade da mais velha |

### 14.1 Peça 1: "desde dd/mm" e o estado "no arquivo" nas telas de série

**O que é.** Onde uma tela mostra série (curva de views, média por dia, views na idade, as primeiras 72 horas), ela passa a saber que a série online começa numa data, e a dizer isso.

**Parte que é correção, não desenho, e vem antes de qualquer saída das séries.** O carregador troca o teto fixo de 365 dias pela data lida do registro: o início da leitura passa a ser o maior entre o começo da série do vídeo e o `online desde` da classe (seção 10.4), que **já conta o mês destacado**. O vídeo é marcado como "série cortada" sempre que o corte avança sobre a série. Com isso, média por dia e views na idade deixam de interpolar entre um zero inventado na data de publicação e o primeiro ponto real (F16). O ramo de texto "desde dd/mm" já existe nas telas para o corte antigo. A troca edita `load.ts` e `series.ts`, que as trilhas de tela da A5 também mexem: é feita em um commit só, em janela combinada (pedido 11 da seção 17).

**Quais idades são marca e quais são interpolação** (no mockup 13, "views por idade"; pelas notas do mockup): **1, 7 e 30 dias vêm das marcas** (`competitor_video_marks`), que não saem do online e continuam aparecendo sempre. **2, 3, 5, 14, 21, 60 e 90 dias são calculados da série** e dependem de o ponto ainda estar online.

| Estado (interno) | O que a tela diz |
|---|---|
| Nenhum mês saiu ainda | Nada muda. A série vai do começo da coleta até hoje |
| A série do vídeo começa antes do `online desde` | Toda medida calculada sobre a série diz **"desde dd/mm"** junto do número |
| A medida precisa de um ponto da série que saiu | Views aos 14 dias de um vídeo cujo dia 14 está no arquivo: **"no arquivo"**, com a data em que saiu, e **nunca um número interpolado**. As idades 1, 7 e 30 dias vêm das marcas e continuam aparecendo sempre |
| O mês saiu das telas e o espaço ainda não foi liberado (intervalo dos dois passos) | O mesmo "no arquivo desde dd/mm". Para quem administra, o ⓘ acrescenta: "ainda dá para trazer de volta enquanto o espaço não for liberado". **A tela nunca promete uma data limite para trazer de volta:** essa data não existe (seção 10.5) |
| O gráfico alcança o trecho que está no arquivo | O eixo mostra onde o online começa e rotula o trecho anterior como "no arquivo desde mm/aaaa", com a porta "Ver antigo" para pedir o período (peça 6) |
| As primeiras 72 horas do vídeo já saíram do online (leitura de hora em hora, janela de 3 meses) | "As 72 primeiras horas deste vídeo estão no arquivo desde dd/mm." A curva não é desenhada; o resumo ("metade das views em N horas") some junto, dito: "não dá para calcular sem as horas". Forma "no arquivo", nunca "não medido", nunca curva vazia |
| O normal do canal foi calculado com menos vídeos porque parte está no arquivo | "Calculado com N vídeos; M estão no arquivo." Se N cair abaixo do mínimo de 3: "não medido: desde dd/mm só há N vídeos com as 72 horas online" |
| O período pedido é maior que o que há online (mockup 21, 6 e 12 meses) | "Mostrando desde dd/mm (3 meses online). Os meses anteriores estão no arquivo", com a porta para a peça 6. A data vem do `online desde` do tipo de dado, **não** da data de início da coleta. A linha que o 21 já tem ("só há 3 meses de leitura") passa a dizer qual dos dois motivos vale: coleta recente, ou arquivo |
| Comentário em destaque cujo texto saiu do online (mockup 20) | "Comentário de mm/aaaa. O texto está no arquivo e não aparece aqui." O cartão mostra a contagem e a data, nunca vazio |
| Mês no arquivo que estava vazio | "Sem registro neste mês (conferimos em dd/mm)". É diferente de "no arquivo" e de "não medido" |
| Antes do começo da coleta | "Antes do início da coleta (03/10/2026)". Nunca "no arquivo" |
| Não medido | "Não foi possível ler desde quando há dado online." A tela não assume 365 dias nem "tudo online" |

**Regra para as janelas de 180 dias.** Nenhuma tela pode pedir mais de 181 dias de série diária nem mais de 90 dias de leitura de hora em hora sem passar pela peça 6. Com 6 meses fechados mais o corrente, no dia 1 de cada mês há 181 dias de série online: as telas que usam 180 dias (15, 17a e 17c) cabem com **1 dia de folga**, e só porque a saída é no dia 1. Elas ganham um teste que falha se a janela online for menor que 181 dias. **Reduzir a janela de 6 para 4 meses (alavanca 10 da seção 8.4, pergunta 6) e a resposta à pergunta 2 (6 ou 12 meses) só se aplicam depois de passar por esses três mockups.**

**Uma data só, lida de uma função.** Nenhuma tela escreve 365 dias, 180 dias ou uma data de início de coleta: todas leem `online desde` e o início da coleta por tipo de dado. Hoje os mockups usam três datas diferentes de início da leitura por hora (04/10 no 13, 11/10 no 15, 14/10 no 21, todas de exemplo).

**Quem lê as três séries além do carregador.** Depois de uma saída, um `min()`, um `count()` ou um "desde" calculado direto sobre as três séries muda de valor sem erro nenhum. A regra: **todo leitor ou é limitado à janela por construção, ou passa a ler o começo real no registro do arquivo (o primeiro mês em `obs_archive_months`), ou o texto muda para "online desde".** A lista nasce aqui com os leitores já achados (F48) e é fechada por busca no plano; leitor novo sem linha nesta tabela reprova a revisão.

| Leitor | O que lê hoje | O que passa a dizer depois de uma saída | Teste |
|---|---|---|---|
| Carregador das telas (`apps/web/src/lib/youtube/observatorio/load.ts` e `series.ts`; `load-channel.ts` usa o mesmo `dailyReadFrom`; `load-page.ts` chega a ele por `loadLiveRows`) | A série diária, com teto de 365 dias | O que esta seção descreve, também na página do canal | Itens de aceite 34 e 35 |
| `competitor_hourly_health` (campo `desde`) e `apps/web/src/lib/youtube/horaria/prova.ts` | `min(hour_slot)` da leitura crua | "Desde" passa a ser o começo real, lido do registro; o `min()` da tabela vira "online desde" | Com um mês de leitura horária fora, `desde` não pula de outubro para novembro |
| `competitor_channel_removal_impact` (contagens por canal) | Conta `early` e `hourly` inteiras, **e `daily_days` sobre a diária inteira** | Soma o que está online com o que está nos meses no arquivo (`rows_total`; para `daily_days`, os dias medidos do resumo), e diz as duas parcelas | Nenhuma das três contagens do canal cai depois de uma saída |

**Mockups da A5 que esta fase toca** (conferido pelas notas de cada mockup, em 13/10; o revisor de UX não abriu navegador):

| Situação | Mockups |
|---|---|
| **Mudam** | **13** (blocos "views por idade", "as 72 horas, hora a hora" e "dia a dia"); **15** ("Primeiras 72 horas", "Linha do tempo" de 90 dias, barras de 180 dias); **21** (seletor de período de 6 e 12 meses e a fase de lançamento; ainda segurado: a mudança entra antes de ele ser aprovado); **18** (seção 14.5, e o diálogo de remover canal, seção 14.3); **20** (comentários de destaque: seção 14.3 e a linha acima); a tela Canais (o diálogo de remover canal, seção 14.3); e a fila "Saíram do YouTube", do lote 1 (seção 14.7) |
| **A confirmar na fase de mockup** | **14** (views por dia entre 30 e 90 dias); **17a** e **17c** (janelas de 180 dias) |
| **Não mudam** | **16** (lê direção em 28 dias contra 28) e **17b** (lê as marcas de idade, que não saem do online); **11b** e **3b** (canal próprio: está fora da política de saída desta fase, seção 2, não objetivo 4) |
| **Não existe** | O esboço **19** ("Ver antigo"). O spec 04 da A5 o previa, mas ele nunca foi desenhado (não há pasta dele em `docs/superpowers/mockups/`). **O mockup 19 nasce do zero nesta fase** (seção 14.9). O nome "Ver antigo" é do dono e fica no botão, com a frase "Ver o que está no arquivo" abaixo |

A primeira tarefa da fase de mockup é fechar esta lista abrindo cada tela com o caso cheio simulado em 2028.

### 14.2 Peça 2: a página do arquivo, com o caminho de cada mês

**O que é.** A peça que o dono pediu quando disse que a saída do 7º mês "precisa de algo adicionado visualmente".

**Onde mora.** Em uma **página própria, "Arquivo", no Observatório**, com um bloco por tipo de dado. O aviso de limite (mockup 18) é uma pastilha e um painel curto, e a fila "Saíram do YouTube" é sobre canais e vídeos: nenhum dos dois comporta três tipos de dado com sete meses online mais o arquivo. Chegam à página: a pastilha do banco (peça 5), em "ver o que pode sair"; a marca "automático desligou" (peça 4); e o botão "Ver antigo" das telas de série. O painel do 18 mostra só o resumo ("2 meses prontos para sair") e leva até lá.

**Frase-resumo no topo de cada tipo**, com o próximo marco e a próxima ação, nessa ordem. Exemplo de conteúdo (o texto final é do mockup): "Views por dia: 7 meses online, 0 no arquivo. Outubro pode sair em 01/05/2027 (faltam 200 dias). Hoje já falta: conferir o B2."

**A forma visual: cada mês é uma linha com a régua de cinco etapas.** O título na tela é "O caminho de cada mês". As etapas: copiado e verificado no NAS; conferido no B2; recuperação testada; fora do prazo de espera; pronto para sair. Cada etapa tem uma de cinco formas, as mesmas do mockup 18:

| Forma | Quer dizer |
|---|---|
| Círculo com visto | feita e válida |
| Círculo pontilhado | falta, ou ainda não existe |
| Triângulo âmbar com "!" | atrasada ou vencendo |
| Octógono vermelho com "!" | parada, ou o arquivo não bate |
| Hachura rosa | não medido |

Nada depende só da cor: cada forma tem seu símbolo e a linha traz o texto. **"No arquivo" tem forma própria**, diferente de "não medido", de "ainda não existe" e de "zero": contorno sólido neutro com o ícone de caixa de arquivo, nas telas de série e nesta página. **A linha que precisa do dono sobe para o topo do tipo e é a única com contorno de cor;** mês saudável é cinza com um verde pequeno. Verde nunca ocupa a tela inteira: o que está bem recua.

**As formas dos estados que a régua de cinco etapas não cobre:**

| Estado | Forma |
|---|---|
| Depois de "pronto para sair" (intervalo dos dois passos) | A régua de cinco etapas é substituída por uma linha de **duas etapas, "Saiu das telas" e "Espaço liberado"**, com as mesmas formas: "Saiu das telas" em círculo com visto; "Espaço liberado" em círculo pontilhado enquanto o espaço não voltou; triângulo âmbar aos 14 dias |
| Destacado, precisa voltar | Triângulo âmbar com "!" e contorno âmbar; sobe para o topo do tipo; vira octógono vermelho aos 14 dias |
| De volta, será copiado de novo | Círculo pontilhado com contorno neutro na etapa de cópia (ainda vai chegar), sem cor de alarme |
| Espaço liberado | A linha vira a caixa de arquivo ("no arquivo") |
| "Copiando: 12 de 45 canais" | A barra de progresso, a mesma da peça 6 |
| "Sem registro neste mês" | Círculo vazado (zero medido), diferente da caixa de arquivo e do pontilhado |
| Mês no arquivo com a cópia em risco, ou sem verificação | A caixa de arquivo com o octógono vermelho (em risco, ou mais de 45 dias sem verificação) ou com o triângulo âmbar (mais de 21 dias) |
| Cópia de canal removido em risco; canal removido antes da cópia | Octógono vermelho (no segundo, triângulo âmbar) na etapa de cópia, e a linha sobe para o topo do tipo. Depois da decisão registrada, a linha volta à forma que tinha, com uma marca cinza ao lado: "1 canal removido: N registros perdidos". A forma final é do mockup |
| Círculo pontilhado: "ainda não chegou" contra "devia estar e não está" | O contorno distingue: neutro para a etapa que ainda vai chegar, âmbar para a que está atrasada. A legenda diz isso |

**Densidade.** Os meses no arquivo se agrupam por ano numa linha só ("2027: 12 meses no arquivo, todos conferidos"), que se abre. Ficam à vista só os meses online e qualquer mês com problema, que sobe para o topo do tipo.

**O caminho de cada mês, na ordem:**

| Estado do mês (interno) | Quando | O que a linha diz |
|---|---|---|
| No ar | o mês corrente | "Em coleta" |
| Aguardando a margem | fechado há menos de 28 dias (45 nos comentários) | "Fechado. Cópia a partir de dd/mm". O ⓘ explica por que se espera |
| Copiando | há arquivo devido | "Copiando: 12 de 45 canais", com a barra |
| Copiado e verificado no NAS | tudo recebido, verificação com menos de 24 h | "No NAS, verificado hoje às hh:mm" |
| No B2 | conferência do dono com menos de 35 dias | "No B2, conferido por você em dd/mm" |
| Recuperação testada | ensaio válido para o tipo | "Recuperação testada em dd/mm" |
| Pronto para sair | tudo verde e fora da janela | "Pode sair" (acende o botão da peça 3) |
| Pronto para sair, com o automático ligado e menos de 3 saídas desta parte | o automático pulou o mês porque o banco ainda exige dois passos | "Pode sair, em dois passos, pelo botão. O automático não tira este: faltam N das 3 primeiras saídas" |
| Destacado | primeiro passo dado | "Saiu das telas em dd/mm. O espaço ainda não voltou. Você pode trazer de volta a qualquer momento, até liberar o espaço. A partir de dd/mm você pode liberar o espaço. Até lá não dá para remover canal nem apagar vídeo" |
| Destacado, pronto para liberar | passaram os 7 dias | "Pronto para liberar o espaço. Ainda dá para trazer de volta" |
| Destacado há mais de 14 dias | o segundo passo não veio | Âmbar: "Saiu das telas há N dias e o espaço ainda não foi liberado. Enquanto isso não dá para remover canal nem apagar vídeo. Libere o espaço ou traga o mês de volta" |
| Destacado, precisa voltar | o arquivo do mês tem de ser copiado de novo e o mês está fora do banco | "A cópia de <mês> precisa ser refeita (<o arquivo do NAS está diferente e o do B2 falhou na conferência de dd/mm>), e para isso o mês tem de voltar ao banco. Traga de volta." A única ação é "Trazer de volta", e **ela não depende de cópia nenhuma** (seção 10.5, pontos 3 e 8): todo estado desta tabela tem uma ação possível ou uma espera com fim dito na linha. Quando o único arquivo ruim é o de um canal removido, "Trazer de volta" não é oferecido: vale a linha "Cópia de canal removido em risco", abaixo |
| De volta, será copiado de novo | "trazer de volta" de mês que precisava voltar, ou cujo dado não bateu na volta | "Outubro voltou ao banco online em dd/mm. O mês será copiado de novo"; quando o dado não bateu na volta, com o motivo da seção 14.3: "O dado dele não bateu com a cópia: o mês será copiado de novo". **É o único nome do desfecho de "trazer de volta" que dessela;** "Voltou a não selado", na tabela abaixo, é só do mês que não passou por "sair das telas" |
| No arquivo | descartado, e relido nos últimos 21 dias | "No arquivo desde dd/mm. Liberou N% do banco. Verificado em dd/mm" |
| No arquivo, sem verificação recente | descartado, sem releitura há mais de 21 dias | Âmbar: "No arquivo. Sem verificação há N dias" e, se for o caso, "a casa não respondeu desde dd/mm". Vermelho acima de 45 dias. O que fazer: religar a casa; nada mais |
| No arquivo, cópia em risco | descartado, e o arquivo do NAS sumiu ou está diferente; ou a conferência do B2 acusou arquivo ausente ou diferente | Vermelho: "O arquivo de <mês> no NAS está ausente ou diferente. Este mês já saiu do banco: a cópia que resta é a do B2. Confira o B2 agora e recupere dele (ver os comandos): a versão boa fica guardada lá por N dias". No caso do B2: "A cópia de <mês> no B2 falhou na conferência de dd/mm. A cópia que resta é a do NAS. Rode a conferência de novo (ver o comando)" |
| Cópia de canal removido em risco | arquivo de canal removido ausente ou diferente no NAS, em mês que ainda está online, em mês fora das telas ou em mês já descartado | Vermelho: "A cópia dos registros de 1 canal removido, de <mês>, está ausente ou diferente no NAS. Recupere do B2 (ver os comandos). Enquanto isso <mês> não sai do banco. Se você já recuperou o arquivo, a cópia o confere na próxima rodada (até 12 horas)." A frase "Enquanto isso <mês> não sai do banco." é a do mês online; com o mês destacado ela é "Enquanto isso o espaço de <mês> não pode ser liberado."; com o mês descartado ela é omitida, e a linha diz "A cópia boa só existe no B2." quando o B2 for o único lugar. Depois da decisão: "Os N registros de 1 canal removido, de <mês>, se perderam nas duas cópias (confirmado por você em dd/mm)", em cinza, sem bloquear |
| Canal removido antes da cópia | o canal foi removido depois de exportado e antes de a cópia chegar ao NAS, e a forja informou, em duas execuções com pelo menos 11 horas entre o primeiro e o último informe, que o arquivo não está no NAS nem em `_recebendo` (seção 10.5). Antes disso a unidade fica no estado normal de cópia em andamento, sem frase de decisão (o mês diz "copiando" como diz hoje) | Âmbar: "<Canal> saiu do site antes de os registros dele de <mês> serem copiados para o arquivo. <Mês> espera uma decisão sua (ver os comandos)." Depois da decisão: "Os N registros de 1 canal removido, de <mês>, não chegaram a ser copiados (confirmado por você em dd/mm)", em cinza, sem bloquear. **Nas duas linhas, a frase da perda diz quantos registros eram** ("N registros"), nunca zero nem "sem registro neste mês" |
| Vazio conferido | mês sem registro | "Sem registro neste mês (conferimos em dd/mm)" |

**Os estados de problema**, que aparecem no lugar da etapa que falhou e dizem o que fazer:

| Estado (interno) | O que a linha diz |
|---|---|
| Atrasado | "Cópia atrasada há N dias" (âmbar acima de 5, vermelho acima de 30) |
| A casa não respondeu | "A casa não respondeu desde dd/mm hh:mm. Nada se perde: o mês só sai quando a casa voltar. Veja o que fazer no aviso do banco." |
| NAS fora | "O NAS não está acessível pela forja desde dd/mm hh:mm. Nada se perde: o mês só sai quando o NAS voltar. **O que fazer:** confira se o NAS está ligado e se a pasta do arquivo está montada na forja (ver os comandos)." |
| NAS cheio | "O NAS está cheio: a cópia de <mês> não coube. Nada se perde: o mês só sai depois que houver espaço. **O que fazer:** libere espaço no NAS (ver os comandos). A cópia é refeita sozinha em até 12 horas." |
| Verificação vencida | "Cópia sem verificação há N horas" |
| B2 sem conferência | "B2 sem conferência há N dias: rode o comando no Mac" (com a porta para ver o comando) |
| A conferência do B2 foi tentada e falhou | "Última tentativa de conferir o B2: dd/mm, falhou: faltam N arquivos no B2" (ou "o arquivo está diferente"). **Nesses dois casos a conferência anterior deixa de valer:** "A conferência de dd/mm não vale mais. Rode o comando de novo; nada sai deste mês até lá". Se faltou a chave ("a conferência de dd/mm não pôde ser feita: falta a chave. Rode de novo no Mac que tem a chave") ou o acesso ("não foi possível chegar ao B2"), a conferência anterior continua valendo até completar 35 dias, e a linha diz isso. O site sabe da tentativa porque o comando a registra mesmo quando falha (seção 10.4) |
| Arquivo não bate | "O arquivo de <canal> em <mês> está diferente do que o site guardou. Nada sai deste mês até resolver" |
| Voltou a não selado | Só para o mês que **não** saiu das telas e cujo dado mudou depois da cópia: "O dado deste mês mudou depois da cópia. Será copiado de novo". O mês que voltou e não bateu é "De volta, será copiado de novo", acima |
| Proteção desligada, com um mês fora das telas | Vermelho na linha do mês: "A proteção contra remoção durante a saída não está instalada. Não remova canal nem apague vídeo até resolver: traga o mês de volta ou avise quem cuida do site." Quem acha é o vigia, que lê a proteção enquanto houver mês fora das telas (seção 10.5) |
| Teste de recuperação vencido ou inválido | "Refaça o teste de recuperação: o último é de dd/mm e vale 180 dias" ou "Refaça o teste de recuperação: o formato dos dados mudou em dd/mm". O ⓘ explica: "carregar o mês do B2 num banco de teste e conferir que bate" |
| Falta teste de recuperação de uma das duas séries | "Falta testar a recuperação das primeiras horas: ainda não há mês com registro. É esperado: o teste só é possível quando algum mês tiver registro. Nada precisa ser feito agora" |
| Meses à frente acabando | "O banco só está preparado para receber dados até mm/aaaa. Depois dessa data a coleta para de gravar. Rode o comando de preparar os próximos meses (ver os comandos)." (âmbar abaixo de 6 meses, vermelho abaixo de 3; o texto não muda, a cor sim) |
| Arquivo desligado | "O arquivo está desligado neste site: nada está sendo copiado nem tirado" |
| Não medido | "Não foi possível ler o estado do arquivo" |

**O grupo "Dado de teste".** Enquanto `obs_archive_rehearsal` tiver mês registrado e não encerrado, a página mostra um quarto grupo, **só para quem administra o site**. Regras:

- **A faixa acima do grupo diz o que ele é:** "Dado de teste. Isto é um mês fictício, criado para você testar o caminho inteiro sem tocar no dado real. Nada que sair daqui libera espaço de verdade." Cada linha leva a marca "teste".
- **O caminho e os botões são os mesmos** das outras linhas (ver o que sairia, tirar, trazer de volta, liberar o espaço), com a espera de 1 dia no lugar de 7.
- **A peça 6 aceita o mês de teste só dentro deste grupo,** com a marca "teste"; um pedido de período comum nunca o inclui (é o que o item de aceite 103 testa: um pedido real nunca lê a classe `ensaio`).
- **Quem encerra, e como.** Quando a recuperação foi testada e o descarte de teste foi feito, aparece o botão "Encerrar o dado de teste", só para quem administra. Ao confirmar, o grupo some e a página diz uma vez: "Dado de teste encerrado em dd/mm". O encerramento fica gravado (`closed_at`, seção 10.4), e os meses de teste saem da verificação: não voltam à lista como problema. Antes disso o botão não aparece, e o grupo não some sozinho: o dono não perde o descarte de teste de vista.
- **Nenhuma outra tela lê essa tabela.** O item de aceite 121 cobre o grupo.

### 14.3 Peça 3: tirar o mês do banco online, com confirmação

| Estado (interno) | O que diz e faz |
|---|---|
| Desabilitado | Mostra **qual condição falta**, uma por linha, com um símbolo por linha e a ação de cada uma: "Falta conferir o B2 (última conferência há 41 dias)"; "Cópia sem verificação há 30 horas: a casa não respondeu. Nada se perde: o mês só sai quando a casa voltar. Veja o que fazer no aviso do banco" (com a forja respondendo e o NAS fora ou cheio, a linha é a do estado "NAS fora" ou "NAS cheio" da seção 14.2, com a ação dela, e não fala em "casa"); "Ainda dentro dos 6 meses: pode sair em 01/05/2027". Nunca um botão cinza sem motivo |
| Simulação ("Ver o que sairia") | Botão secundário, sempre disponível, que **não tira nada**. Mostra o que o botão faria hoje: "Se você tirasse outubro de 2026 agora: 45 canais, 1.234.567 registros, 38% do que este tipo de dado ocupa. Contado agora: tudo bate", ou a lista do que falta, na mesma forma do estado desabilitado. Canal removido depois da cópia não entra na contagem; a linha diz "mais 1 canal removido: os registros dele deste mês já estão só no arquivo". Se a cópia de um canal removido se perdeu, a linha diz, à parte: "os N registros de 1 canal removido se perderam (confirmado por você em dd/mm)". Leva a marca "simulação, nada foi tirado". O contador "simulações vistas: 2 de 2" alimenta a peça 4 |
| Habilitado | "Tirar outubro de 2026 do banco online" |
| Confirmação (séries e leitura de hora em hora) | Abre com a prova e fecha com o que se perde: "**Contado agora, no banco:** 45 canais, 1.234.567 registros de outubro de 2026, iguais aos da cópia do NAS (verificada hoje às 06:17) e do B2 (conferido por você em 02/10). A recuperação foi testada em 05/12. **Muda nas telas:** as curvas passam a começar em 01/11/2026 e as medidas mais antigas passam a dizer 'no arquivo'. **Continua:** o mês inteiro, no NAS e no B2. **Para ver de novo:** peça o período em 'Ver antigo' (números por mês)." O botão de confirmar é o mais pesado da janela; o de cancelar recebe o foco inicial; Esc cancela e o foco volta ao botão que abriu a janela |
| Confirmação, quando o banco exige dois passos (as três primeiras saídas de cada parte do tipo) | Acrescenta: "Em dois passos: hoje sai das telas; a partir de dd/mm você pode liberar o espaço. Dá para trazer de volta a qualquer momento, até você liberar o espaço. **Enquanto o espaço não for liberado, não dá para remover canal nem apagar vídeo da fila 'Saíram do YouTube'**". **Quem decide se são dois passos é o banco, não a tela** (seção 10.5): a tela pergunta e mostra o que ele responde |
| Confirmação, da quarta saída em diante | Acrescenta: "**Não volta ao banco por este botão.** Daqui em diante a saída é em um passo só e não há 'trazer de volta'". No tipo "Views por dia", que tem duas partes (views por dia e primeiras horas), uma pode já sair em um passo e a outra ainda em dois: a confirmação diz qual parte ainda pode voltar e qual não |
| Confirmação do tipo "Comentários e dados antigos do YouTube" | "Isto apaga do site o **texto** dos comentários de outubro de 2026 (N comentários de M canais). **O que você perde:** nunca mais verá esse texto no site, nem nos relatórios, que mostram só contagens. **O que continua:** a cópia completa no NAS e no B2, que só se lê com um comando seu. **Não dá para desfazer pelo site.** Para continuar, digite: *apagar comentários de outubro de 2026*." A frase é aceita com maiúscula ou minúscula, e colar não é bloqueado |
| Durante | "Conferindo o banco contra o arquivo" e depois "Tirando" |
| Recusado na hora | A frase do motivo (catálogo fechado; o texto de erro do banco nunca chega à tela). "Ocupado: a coleta está gravando. Tente em alguns minutos." "O dado mudou desde a cópia: nada foi tirado; o mês será copiado de novo". "A última conferência do B2 falhou em dd/mm: rode o comando de novo; nada foi tirado". "A proteção contra remoção durante a saída não está instalada: nada foi tirado. É defeito de instalação; avise quem cuida do site" (`gatilho_ausente`; no segundo passo, a mesma frase com "o espaço não foi liberado") |
| Primeiro passo feito, esperando | "Outubro saiu das telas em dd/mm. O espaço ainda não voltou. **Você pode trazer de volta a qualquer momento, até liberar o espaço.** A partir de dd/mm você pode liberar o espaço." Botão "Trazer de volta" e, desabilitado até a data, "Liberar o espaço (disponível em dd/mm)". **O segundo passo é do dono; não acontece sozinho** |
| Primeiro passo feito, depois dos 7 dias | "Pronto para liberar o espaço. Ainda dá para trazer de volta." Os dois botões ficam habilitados: "Liberar o espaço" e "Trazer de volta". A linha não some nem muda de sentido com o tempo; aos 14 dias fica âmbar e diz "Libere o espaço ou traga o mês de volta" |
| Segundo passo (confirmação) | Diz que **depois disso não dá mais para trazer de volta pelo site**, quanto libera, e que o dado continua no NAS e no B2. Mostra de novo a prova contada na hora |
| Segundo passo recusado | "A cópia não pôde ser confirmada agora (<motivo>). O espaço não foi liberado e o mês continua podendo voltar" |
| Segundo passo repetido | "O espaço deste mês já foi liberado em dd/mm." Não é erro e não fica vermelho |
| Feito | "Saiu em dd/mm às hh:mm. Liberou N% do banco" |
| Trazer de volta | "Outubro voltou ao banco online em dd/mm" |
| Trazer de volta, quando o dado não bateu na volta | "Outubro voltou ao banco online em dd/mm. O dado dele não bateu com a cópia: o mês será copiado de novo." Não é recusa: trazer de volta nunca é recusado por causa de cópia (seção 10.5, ponto 3) |
| Trazer de volta, com a proteção não instalada | O mês volta, e a tela acrescenta: "O mês voltou. A proteção contra remoção durante a saída não está instalada; avise quem cuida do site antes de tirar outro mês." Não é recusa (seção 10.5, linha "Quando o gatilho não existe"). O aviso aparece aqui porque, sem mês fora das telas, o vigia deixa de ler a proteção e o vermelho da linha do mês some |
| Trazer de volta, quando o banco acha registro sem vídeo | Vermelho: "Não foi possível trazer de volta: o banco encontrou registros sem vídeo. Nada foi alterado; o mês continua fora das telas. Avise quem cuida do site." É o único caso em que "trazer de volta" falha (`orfa_inesperada`, seção 10.5, ponto 3): só acontece com a proteção desligada à mão, e o conserto é manual, pelo runbook |
| Remover canal ou apagar vídeo, com um mês fora das telas | No diálogo de remover canal (tela Canais e mockup 18) e no "apagar" da fila (peça 7), **antes do clique**, no lugar do botão: "<Outubro de 2026> saiu das telas e o espaço dele ainda não foi liberado. Enquanto isso não dá para remover canal nem apagar vídeo. <O espaço só pode ser liberado a partir de 24/10; até lá, o que dá para fazer é trazer o mês de volta.> / <Você já pode liberar o espaço ou trazer o mês de volta.> (abrir o Arquivo). Quem só edita o site: peça a quem o administra." **Regras da frase:** a data é a do botão "Liberar o espaço (disponível em dd/mm)" do mês, e a mais distante se forem vários; com mais de um mês fora das telas, os nomes vão no plural, na mesma frase ("Outubro e novembro de 2026 saíram das telas e o espaço deles ainda não foi liberado"; o banco devolve os meses na recusa); a frase não promete prazo para **trazer de volta**, que continua sem limite (seção 14.2); a data vem sempre como "a partir de dd/mm", como nas linhas do mês, porque no próprio dia o botão já está liberado; **o link "(abrir o Arquivo)" só aparece para quem administra o site** (a página do Arquivo é dele: seção 14.8, perfil só leitura); quem só edita vê a frase sem o link, com "peça a quem o administra", e, depois da data, no lugar de "Você já pode liberar o espaço ou trazer o mês de volta.", vê "O espaço já pode ser liberado, e o mês também pode voltar, por quem administra o site." **O porquê, uma vez, no ⓘ da frase:** "Enquanto o mês pode voltar ao banco, remover o canal deixaria, na volta, registros dele sem canal a que pertencer." Se o mês saiu das telas entre abrir o diálogo e clicar, o banco recusa e a tela mostra a mesma frase: **nada foi removido**. O código da recusa (`mes_destacado_em_transito`) nunca chega à tela. Exportar o canal continua permitido. Forma: círculo pontilhado com contorno neutro e o nome do mês (é espera com saída dita, não erro) |
| Banco em somente leitura | "O banco passou do limite e está em modo somente leitura. Siga o passo de emergência" |
| Não respondeu | Não se aplica ao clique em si (ele fala com o banco, não com a casa); a casa fora aparece como condição que falta |

**Como se recupera um mês que está no arquivo**, dito em todo estado em que a pergunta cabe: pelo site, só como relatório com números por mês (peça 6); depois que o espaço é liberado, voltar ao banco online é um comando manual do dono, nunca um botão.

### 14.4 Peça 4: o interruptor do automático

Um por tipo de dado. **Não existe para "Comentários e dados antigos do YouTube"**, e a tela diz por quê ("comentários saem sempre por clique").

| Estado (interno) | O que diz |
|---|---|
| Indisponível | "Falta: 3 saídas feitas por você (1 de 3) e 2 simulações vistas (0 de 2)". Uma barra para cada contagem |
| Disponível e desligado | "Desligado. Você tira cada mês pelo botão" |
| Ligar (confirmação) | A regra inteira em linguagem simples: sai no máximo um mês por dia; só com as duas cópias conferidas e a recuperação testada; vale 90 dias; **continua precisando da sua conferência mensal do B2**. E **a lista do que o desliga, a mesma da tabela de motivos abaixo**, em linguagem simples: "o arquivo de algum mês fica diferente; a casa fica mais de 36 horas sem responder; a cópia fica sem verificação duas vezes seguidas; a cópia atrasa mais de 30 dias; o banco passa de 85% ou não pode ser medido; mais de um mês sairia no mesmo dia; a validade acaba; o automático é desligado na configuração; a conferência do B2 falha; ou o banco recusa tirar um mês". Para ligar, o dono digita a frase que a tela pede: *ligar automático de views por dia* |
| Ligado | "Ligado até dd/mm. Próximo mês: novembro, em 01/06/2027" |
| Ligado, com uma parte ainda em dois passos | "Ligado até dd/mm. As primeiras horas ainda saem pelo botão, em dois passos (1 de 3 saídas feitas)". O automático pula essa parte e continua ligado |
| Perto de vencer | "Vence em N dias" |
| Desligou sozinho | "Desligou sozinho em dd/mm: <motivo>", com a frase da tabela de motivos abaixo e, na linha seguinte, o que fazer: "Para ligar de novo: resolva o motivo, veja uma simulação nova e digite a frase". Fica visível até o dono ver; **não religa sozinho** |
| O aviso fora da página | A pastilha do banco (peça 5, presente em todas as telas do Observatório) leva a marca "automático desligou em dd/mm" até o dono abrir esta peça. A forma é o triângulo âmbar com "!" já usado no 18 |
| Travado pela configuração | "O automático está desligado na configuração do site." O nome da variável (`OBS_ARQUIVO_AUTO_DROP`) aparece só no ⓘ |
| Não medido | "Não foi possível ler o estado do automático. Enquanto isso, nada sai sozinho" |

**Os motivos do desligamento: lista fechada, igual à da seção 12.4.** Nenhum motivo cai fora dela, e o código da recusa nunca chega à tela.

| # | Motivo (interno, na ordem da seção 12.4) | O que a tela diz |
|---|---|---|
| 1 | Arquivo diferente na verificação (mês online, fora das telas ou já no arquivo) | "O arquivo de <mês> ficou diferente do que o site guardou. Nada sai até você resolver." |
| 2 | Casa fora por 36 horas | "A casa ficou mais de 36 horas sem responder. Veja o que fazer no aviso do banco." |
| 3 | Cópia sem verificação duas vezes seguidas | "A cópia de <mês> ficou sem verificação em duas rodadas seguidas. Veja se a casa está respondendo." |
| 4 | Cópia atrasada | "A cópia atrasou mais de 30 dias." |
| 5 | Banco acima de 85% | "O banco passou de 85%: agora quem decide é você; veja o que pode sair." |
| 6 | Banco sem medida hoje | "Não foi possível medir o banco hoje." |
| 7 | Dois meses em 24 horas | "O automático tentou tirar mais de um mês no mesmo dia e parou." |
| 8 | Validade acabou | "A validade de 90 dias acabou." |
| 9 | Configuração | "O automático foi desligado na configuração do site." |
| 10 | Conferência do B2 retirada | "A conferência do B2 de <mês> falhou em dd/mm: <faltam arquivos, ou o arquivo está diferente>." Rodar o comando num Mac sem a chave não desliga o automático |
| 11 | Outra recusa do banco | "O banco recusou tirar <mês>: <frase do motivo, do catálogo fechado da seção 14.3>." |

**Quatro recusas não desligam, e a tela não as mostra como problema:** o mês ainda dentro do prazo; a coleta gravando naquele instante (o automático tenta de novo no mesmo dia); a parte que ainda exige dois passos (o estado "ligado, com uma parte ainda em dois passos"); e o mês que ficou fora das telas, esperando o segundo passo do dono (o automático o pula e tira o seguinte). A primeira cópia sem verificação também não desliga: só a segunda seguida, que é o motivo 3.

**Depois que desliga, os contadores.** As saídas feitas por você continuam contando, e a peça não volta a "Indisponível". Para ligar de novo, o dono vê uma simulação nova (uma, feita depois do desligamento) e digita a frase outra vez; a validade recomeça em 90 dias.

### 14.5 Peça 5: o aviso de limite, em percentual do banco inteiro

O mockup **18** foi redesenhado e aprovado pelo dono em 13/10, em percentual do banco inteiro do site, e tem uma linha reservada ("Backup no NAS ao chegar a um percentual do limite"), marcada "ainda não existe". Esta fase preenche essa linha e muda a previsão.

**Duas divergências declaradas do 18 aprovado, que voltam ao dono:**

1. **A regra de cor.** No 18 aprovado a cor do preenchimento vem do tamanho de hoje, e o vermelho por previsão vem da pastilha e do "enche em N dias". Aqui a cor da pastilha e da frase passa a seguir **o mais que o banco chega a ocupar antes da próxima saída**, não o tamanho de hoje. O 18 é ajustado (a barra ganha um segundo marcador, "chega a 78% antes da próxima saída", e a tabela de coerência da seção 7 das notas do 18 é refeita).
2. **O que o percentual faz.** O dono pediu, no retorno do 18, que ao chegar a um percentual o banco fosse copiado ao NAS. Aqui a cópia é mensal e automática, sempre; o percentual só avisa e sugere o que tirar (seções 1 e 12.5). O ⓘ do 18, que hoje diz "Backup no NAS (ainda não existe; será ao chegar a um percentual...)", é reescrito.

| O que muda no 18 | O que tem de dizer |
|---|---|
| A linha reservada | Deixa de dizer "ainda não existe". Passa a dizer o estado da cópia ("Todo mês fechado é copiado para o NAS e para o B2. Última cópia: dd/mm") e, com 70% ou mais, **o que pode sair agora**: "2 meses prontos para sair: liberam cerca de N% do banco", com a porta para a página do arquivo |
| A previsão | Deixa de ser a reta simples. A frase: "Antes de novembro sair o banco chega a 78% do limite." A palavra "pico" não vai à tela |
| Os dois prazos | Aparecem na régua do tempo que o 18 já tem (de zero a um ano, com a zona de 90 dias): um losango "o banco chega a 85%" e um traço "o próximo mês fica pronto para sair". Se o losango vem antes do traço, o espaço entre os dois é pintado de âmbar a vermelho, com a frase "o alívio chega depois do aperto" |
| "Quem ocupa" | Ganha a parte que as séries divididas por mês ocupam, somada certo (pedido 3 da seção 17), inclusive o mês que saiu das telas e ainda não teve o espaço liberado. Continua em percentual; os MB só no ⓘ |
| Com 85% ou mais | Lista, em ordem, o que rende: meses prontos para sair; as alavancas de reserva (seção 8.4), cada uma com quanto libera e o que alguma tela perde; e quantos canais teriam de sair. **Nenhuma linha fala em plano pago** |
| Depois de uma saída | "Novembro saiu em 01/06: o banco foi de 71% para 64%". O percentual que cai não vira verde se o banco ainda chega a mais de 70% antes da próxima saída |
| A marca do automático | "Automático desligou em dd/mm", até o dono abrir a peça 4 |
| A casa não responde | "A casa não responde desde dd/mm: nenhum mês pode sair até ela voltar. No ritmo de hoje o banco chega a 85% em mm/aaaa. **O que fazer:** peça a quem está em casa para religar a forja e o NAS (se não houver ninguém, a data acima é a sua folga: nada mais a fazer agora); até lá, não acrescente canais. Se chegar a 85% antes disso, pause a coleta de canais (ver o comando)." A frase não depende da casa: quem mede o banco e o silêncio dela é o site (seção 13.6). **A pausa é o comando `pausar` da E10, rodado no Mac:** enquanto a E10 não estiver em produção, a última frase dá lugar a "A pausa da coleta ainda não existe", para o dono não procurá-la. **A pastilha e a frase aparecem também quando a forja responde e o NAS não** (NAS fora ou cheio): a primeira frase passa a "O NAS não está acessível desde dd/mm" ou "O NAS está cheio", com a ação da linha correspondente da seção 14.2, e o resto não muda |
| Sem leitura hoje | Como já está no 18: a data e o valor da última medida, e a cor nunca é verde |
| Não medido | Como já está no 18. E, novo: se o site não consegue ler o tamanho das séries divididas por mês, a pastilha diz "não medido", não o número parcial |

### 14.6 Peça 6: o pedido de período longo e a espera

**O que é.** A porta para o dado que saiu do online: "ver 12, 24 ou 36 meses, ou tudo". Aparece onde a peça 1 diz "no arquivo", no botão "Ver antigo". A tela de relatório completa é spec posterior (D12); aqui a peça mínima é o pedido, a espera e um resultado simples por mês.

| Estado (interno) | O que diz |
|---|---|
| Antes de pedir | O que será lido ("os 12 meses de <canal>: 6 estão online, 6 no arquivo") e que **não é na hora**: "a resposta leva de alguns segundos a alguns minutos e depende de a casa estar ligada" |
| Não há nada no arquivo ainda | "Ainda não há mês no arquivo. O primeiro sai em 01/02/2027." O botão não aparece |
| Arquivo desligado | "O arquivo está desligado neste site. Nada foi pedido." |
| Enviado | "Pedido feito às hh:mm. Aguardando a casa." Botão "Cancelar pedido" enquanto estiver pendente |
| Em andamento | "Lendo: 9 de 24 meses", com a barra |
| Em andamento, ao reabrir a página | "Há um pedido seu em andamento desde hh:mm. Pode fechar esta página: o resultado fica aqui por 30 dias." |
| Pronto | O resultado por mês, **com a cobertura de cada mês** ("29 de 31 dias medidos") e a data: "gerado em dd/mm às hh:mm; vale até dd/mm". Resultado guardado é servido com a idade à vista. Mês que ainda está online e não foi copiado vem do banco e leva a marca "parcial" |
| Venceu | "O resultado de dd/mm venceu. Peça de novo." |
| Incompleto | "Faltam 2 de 24 meses: <quais>, <motivo>". Os meses que vieram aparecem; os que faltam aparecem como faltando, **nunca como zero** |
| Mês vazio | "Sem registro neste mês (conferimos em dd/mm)" |
| Não respondeu | "A casa não respondeu em 15 minutos. O pedido venceu; nada foi perdido. Tente de novo quando ela voltar. Último sinal: dd/mm hh:mm" |
| NAS fora | "A forja respondeu, mas o NAS não está acessível" |
| Arquivo não bate | "O arquivo de <mês> está diferente do que o site guardou. O relatório não foi montado com ele" |
| Grande demais | "O período pedido passa do tamanho que o site guarda. Peça menos canais ou menos meses" |
| Pedido repetido | "Já há um pedido igual em andamento" |
| Cancelado | "Pedido cancelado às hh:mm" |
| Não medido | "Não foi possível ler o estado do pedido" |

**O que o resultado nunca mostra:** texto de comentário e identificador de comentário vindos do arquivo (seção 11.2).

### 14.7 Peça 7: o arquivo pendente na fila "Saíram do YouTube"

A E9 projetou e não construiu o caminho de dois passos para o "apagar" alcançar o arquivo. Entra aqui, enxuto (D9), com o fluxo da seção 11.3.

| Estado (interno) | O que diz |
|---|---|
| Apagado no online, com cópia no arquivo | "Apagado do site. Há cópia no arquivo: 1 espera você rodar os comandos" |
| Apagar, com um mês fora das telas | A frase da linha "Remover canal ou apagar vídeo, com um mês fora das telas" da seção 14.3, no lugar do botão "apagar". O item fica na fila, sem cor de erro e sem contar prazo |
| "Ver os comandos" | Em dois tempos (seção 11.3). Primeiro o comando do Mac e os passos de **copiar** as versões novas, um por linha. Os passos de **apagar** as antigas, no NAS e no B2, só aparecem depois que as novas foram verificadas no NAS e conferidas no B2; até lá a tela diz "falta verificar a cópia nova" ou "falta conferir o B2 de novo (ver o comando)". Os passos alcançam os três arquivos do mês (os registros, o resumo e a lista de conferência) |
| "Já rodei" | Fecha o item. A verificação seguinte confirma que o arquivo mudou como o site esperava |
| "Já rodei", mas o arquivo ainda tem o vídeo | Âmbar: "Você marcou que rodou em dd/mm, mas a verificação de hoje ainda encontra os registros de <canal> no NAS. O item voltou para a lista." |
| Cópia antiga de comentários a apagar | "Há uma cópia antiga dos comentários de <mês>, substituída em dd/mm. Ela já pode ser apagada: veja os comandos." Aparece 30 dias depois de a cópia nova estar verificada no NAS e conferida no B2 (seção 11.3), na mesma lista e com a mesma barra de idade |
| Pendente há mais de 30 dias | Âmbar: "há N dias esperando os comandos", com a barra de idade |
| Pendente há mais de 60 dias | Vermelho |
| Não medido | "Não foi possível ler se há cópia no arquivo." Nunca "não há cópia" |

O ⓘ diz por que a lista pode ser longa: os registros do vídeo só saem do arquivo quando o dono roda o comando.

**Mockup que toca:** a fila "Saíram do YouTube", do lote 1 da A5.

### 14.8 O que cada peça precisa para ser validável como mockup

O que o spec 04 da A5 já exige de todo mockup (item "O que cada mockup tem de mostrar para ser validável", linha 165 daquele arquivo) vale aqui. Como nenhum mês saiu ainda, **todo número de mês arquivado nos mockups desta fase é exemplo**, e o topo de cada mockup diz isso.

**O que todo mockup desta fase tem de trazer, ou volta reprovado:**

1. **Frase-resumo no topo**, com número, mês e data, escrita sem palavra da lista do item 38.
2. **Uma régua, barra ou forma por peça.** Peça 1: o eixo com o trecho que está no arquivo. Peça 2: a régua de cinco etapas por mês e, depois dela, a linha de duas etapas ("Saiu das telas", "Espaço liberado"). Peça 3: a lista de condições com um símbolo por linha. Peça 4: a barra das três saídas e das duas simulações. Peça 5: a régua do tempo com os dois marcos. Peça 6: a barra "9 de 24 meses" e a cobertura por mês. Peça 7: a barra de idade do pedido de comando.
3. **Cada estado por cor e por forma;** legenda das formas e das cores em um só lugar.
4. **As três ausências com forma própria, que nunca se confundem:** "não medido" (hachura rosa, com o motivo), "não respondeu" (octógono ou triângulo com a data do último sinal) e "no arquivo" (caixa de arquivo).
5. **Método no ⓘ de cada peça, e só lá:** o que a cópia garante, por que 28 dias, por que 6 meses.
6. **Casos:** cheio (3 tipos, 7 meses online, 36 no arquivo, 45 canais); magro (nada saiu ainda, tudo "ainda não existe"); um mês com 1 canal em erro; casa desligada há 3 semanas; B2 vencido; arquivo que não bate; chave ausente (tentativa que falhou); mês que saiu das telas e espera o segundo passo; sem permissão; carregando; erro; texto longo (nome de canal com 40 caracteres). **E um quadro por estado de cada tabela das seções 14.1 a 14.7**, em especial:
   - peça 1: as 72 horas no arquivo; o normal do canal com menos vídeos; o período maior que o online (6 e 12 meses); o comentário em destaque sem texto; o perfil só leitura (peça 1 com "No arquivo desde mm/aaaa" e sem as peças 2, 4, 5, 6 e 7);
   - peça 2: a linha de duas etapas depois do primeiro passo; o âmbar dos 14 dias com a ação; "precisa voltar" e "de volta, será copiado de novo", com as formas da tabela; "NAS fora" e "NAS cheio", cada um com a sua ação; a proteção desligada com um mês fora das telas; o mês no arquivo verificado, sem verificação recente e com a cópia em risco; a cópia de canal removido em risco, antes e depois da decisão registrada, e o canal removido antes da cópia; a conferência do B2 que falhou e deixou de valer; o grupo "Dado de teste" com a faixa, a marca e o botão de encerrar, e a página depois de encerrado; "pode sair, em dois passos, pelo botão";
   - peça 3: a simulação; a confirmação do segundo passo; o primeiro passo feito com "trazer de volta" e "liberar o espaço" desabilitado; o mesmo depois dos 7 dias, com os dois botões; o segundo passo recusado; o segundo passo repetido; trazer de volta quando o dado não bateu; trazer de volta com o aviso da proteção não instalada; o diálogo de remover canal com um mês fora das telas (antes do clique, e recusado pelo banco no clique; antes e depois da data de liberar o espaço; com dois meses; e visto por quem só edita o site, sem o link para o Arquivo); trazer de volta que falhou por registro sem vídeo; a recusa por proteção não instalada; a confirmação do texto de comentário com a frase digitada;
   - peça 4: indisponível; ligar, com a frase digitada; ligado; ligado com uma parte ainda em dois passos; perto de vencer; travado pela configuração; e desligado sozinho, **uma vez por motivo da tabela da seção 14.4**;
   - peça 5: a casa não responde, com a data em que o banco chega a 85% e o que fazer; a marca "automático desligou" na pastilha do banco;
   - peça 6: o arquivo desligado; o resultado vencido; o pedido em andamento ao reabrir a página; o pedido cancelado;
   - peça 7: "apagar" bloqueado por um mês fora das telas; "ver os comandos" antes e depois de a cópia nova estar conferida; "Já rodei" refutado; a cópia antiga de comentários a apagar.
7. **1440 e 390 px, tema claro e escuro,** alvo de toque de 44 px, sem rolagem horizontal, foco visível, Esc fecha a confirmação e devolve o foco, movimento reduzido.
8. **Contraste medido** (3:1 nos símbolos e nas formas, 4,5:1 no texto) nos dois temas, escrito na revisão.
9. **Escala de cinza:** a linha de problema continua à frente das demais.
10. **A marca "exemplo"** em todo número que não é real.
11. **Índice de estados.** Cada mockup traz uma tabela "estado da seção 14.x → quadro do mockup", com uma linha por estado das tabelas das seções 14.1 a 14.7 que a peça cobre. O revisor de UX confere o índice contra a seção 14 antes de aprovar: estado sem quadro reprova. É por esse índice que os itens de aceite 84, 85, 94, 105 e 121 se verificam num mockup, além do teste de código.

Ordem sugerida para a fase de mockup, pelo que destrava: a peça 2 com a 3 (destravam o ensaio e o clique de fevereiro), a 1 (destrava a saída das séries; é o mockup 19), a 5 (ajuste do 18), a 4, a 6 e a 7.

### 14.9 Sincronia com os mockups aprovados

Pedido expresso do dono: há mockups aprovados da A5 a sincronizar na implementação.

1. **Nenhum mockup aprovado é editado.** Cada pasta aprovada fica congelada (convenção do lote). A mudança desta fase é desenhada em **um mockup novo, o 19** ("o que muda nas telas de série quando um mês sai"), que mostra cada tela tocada, antes e depois, no caso cheio simulado em 2028 e no caso de hoje. Cada tela leva o selo "ajuste de mockup aprovado: <número>, <data da aprovação>". **O 18 é a exceção:** ganha uma versão `18-v2` na própria pasta, porque a peça 5 muda a regra de cor.
2. **Cada mudança é uma linha numa tabela** (tela, mockup aprovado e data, o que muda, onde está o desenho, aprovação do revisor de UX, aprovação do dono, commit). A tabela mora na pasta do mockup 19 e é item de aceite. O diálogo de remover canal tem duas linhas nela, a da tela Canais e a do mockup 18 (seção 14.3): sem elas faltaria o selo "ajuste de mockup aprovado".
3. **Ordem.** A A5 implementa o mockup aprovado como está; esta fase implementa só a diferença, em commit próprio por tela, depois da aprovação do 19. Se o código da A5 e o mockup divergirem, o mockup é corrigido no mesmo dia (o código vale, o mockup acompanha), e o dono é avisado.
4. **Uma data só, lida de uma função** (seção 14.1). O teste varre os arquivos das telas à procura de 365, de 180 e de datas de início de coleta escritas à mão.
5. **Registro.** O `ROTEIRO-DE-TESTE-E-MELHORIAS.md` ganha, em cada mockup tocado, a seção "O que a fase de manutenção muda", e o roteiro de cada peça nova. A tabela de status do roteiro é conferida contra `APROVACOES-DO-DONO.md` antes de o 19 ir ao dono: hoje as duas divergem (o roteiro diz 13 e 15 "em ajuste" e 18 "reprovado"; as aprovações dizem os três aprovados em 13/10).
6. **Aprovação.** O dono aprova o 19, o `18-v2` e cada peça nova, um por vez; nenhuma linha de código de tela nasce antes.
