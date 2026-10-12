# Observatório, fase A5 (spec v2.2), parte 02: comentários de destaque

> Parte do spec da A5 v2.2, dividido em 12/10/2026 só movendo texto (nenhuma frase mudou; a numeração de seções, etapas, migrations, perguntas e itens de aceite é a do original). Índice, cabeçalho "O que mudou" e tabela "onde está cada seção": [`../2026-10-12-observatorio-a5-concorrentes-design.md`](../2026-10-12-observatorio-a5-concorrentes-design.md).

### 4.6 Etapa E14: comentários de destaque dos vídeos de concorrentes (emenda v2.1; migration MG8)

**Decisão do dono (12/10, item 19 do arquivo de decisões):** coletar "cerca de 12 comentários" por vídeo de terceiro, "divididos da seguinte forma: comentários mais curtidos, e interagidos por canais verificados ou o próprio criador".

**O que se perde a cada dia sem ela:** o retrato dos comentários de cada vídeo novo nas idades 1, 7 e 30 dias. A API só devolve o estado de agora; o que estava no topo no primeiro dia não volta.

**Exceção declarada ao princípio D1** ("nada de chamada nova por vídeo"): comentário só vem por uma chamada por vídeo. O custo está em 9.5 e é pequeno; a exceção vale só para esta etapa.

#### 4.6.1 O que a API permite e o que não permite (documentação oficial, lida em 12/10)

Lido por ferramenta que devolve trechos das páginas; cada linha traz a página. **NC** = a documentação não diz; a coluna diz como confirmar com **uma chamada de leitura**, que é o primeiro passo da etapa (item de aceite 107) e não foi feita para este spec (nenhuma chamada com credenciais do projeto). Páginas: [commentThreads.list](https://developers.google.com/youtube/v3/docs/commentThreads/list), [recurso commentThread](https://developers.google.com/youtube/v3/docs/commentThreads), [recurso comment](https://developers.google.com/youtube/v3/docs/comments), [comments.list](https://developers.google.com/youtube/v3/docs/comments/list), [custo de cota](https://developers.google.com/youtube/v3/determine_quota_cost), [recurso channel](https://developers.google.com/youtube/v3/docs/channels), [guia de comentários](https://developers.google.com/youtube/v3/guides/implementation/comments), [histórico de revisões](https://developers.google.com/youtube/v3/revision_history).

| # | Pergunta | O que a documentação diz | Consequência |
|---|---|---|---|
| 1 | Dá para ordenar por curtidas? | **Não.** `order` aceita dois valores: `time` ("This is the default behavior") e `relevance` ("Comment threads are ordered by relevance"). Não há valor de curtidas, e a página **não define** "relevance" ([commentThreads.list](https://developers.google.com/youtube/v3/docs/commentThreads/list)) | "Relevância" **não é** "mais curtidos". A regra é ler a primeira página por relevância (até 100 conversas) e ordenar por `likeCount` do nosso lado. **Garante:** os mais curtidos **entre os lidos**; e, quando a resposta vem sem `nextPageToken`, os mais curtidos do vídeo inteiro. **Não garante:** que um comentário muito curtido fora dos 100 primeiros por relevância esteja na amostra. A tela diz "entre os N lidos" |
| 2 | Itens por página e custo | `maxResults` de 1 a 100 (padrão 20) nas duas listas; `commentThreads.list` custa 1 unidade e `comments.list` custa 1 unidade ([commentThreads.list](https://developers.google.com/youtube/v3/docs/commentThreads/list), [comments.list](https://developers.google.com/youtube/v3/docs/comments/list), [custo de cota](https://developers.google.com/youtube/v3/determine_quota_cost)) | uma chamada de 1 unidade por vídeo e marco |
| 3 | Campos do comentário | `textDisplay`, `textOriginal`, `likeCount`, `publishedAt`, `updatedAt`, `authorDisplayName`, `authorProfileImageUrl`, `authorChannelUrl`, `authorChannelId.value`, `parentId`; da conversa: `totalReplyCount`, `canReply`, `isPublic`, `topLevelComment` ([recurso comment](https://developers.google.com/youtube/v3/docs/comments), [recurso commentThread](https://developers.google.com/youtube/v3/docs/commentThreads)). `authorChannelId` e `authorChannelUrl` vêm "if available". O histórico de revisões cita, em 30/09/2026, uma propriedade nova `snippet.imageUrl` (**NC**: lido de relance; se existir, é imagem anexada ao comentário e **não é gravada**) | todos os campos que a regra usa existem |
| 4 | `textDisplay` × `textOriginal` | `textOriginal`: "The original text is only returned to the authenticated user if they are the comment's author". `textDisplay` pode vir em HTML ou texto puro (`textFormat=plainText`), e "Even the plain text may differ from the original comment text" ([recurso comment](https://developers.google.com/youtube/v3/docs/comments)) | grava-se `textDisplay` com `textFormat=plainText`. **NC:** se `textOriginal` vem com chave de API (a página diz que não; a chamada de leitura mostra). Não se depende dele |
| 5 | Respostas dentro da conversa | `replies.comments[]` "contains a limited number of replies" e é "only a subset of the total number of replies"; para todas, `comments.list` com `parentId` ([recurso commentThread](https://developers.google.com/youtube/v3/docs/commentThreads)). **NC:** quantas vêm (a página não dá o número) e em que ordem (a página de `comments.list` não fala de ordem). Confirma-se na chamada de leitura, numa conversa com mais de 20 respostas | a resposta do criador pode estar **fora** do subconjunto: ver a linha 6 |
| 6 | "Interagido pelo próprio criador": **(a) o criador respondeu** | **Dá para detectar, com uma lacuna.** Cada resposta é um recurso `comment` com `authorChannelId.value`; se for igual ao id do canal do vídeo (que já temos em `competitor_channels`), a resposta é do criador. **Isto é inferência nossa: a documentação não tem um campo "resposta do dono do canal"** | exato quando `replies` traz todas as respostas (`totalReplyCount` = número de respostas vindas); quando vem só parte, "o criador não respondeu" **não pode ser afirmado**: o estado é "não se sabe", a menos que se gaste 1 unidade por conversa em `comments.list?parentId=` (pergunta 11) |
| 7 | **(b) o comentário é do próprio criador** | mesmo teste, no comentário de topo | exato |
| 8 | **(c) coração do criador** | **Não existe.** O recurso `comment` não tem campo de coração; o histórico de revisões (primeiros 100 mil caracteres lidos) não cita "heart" ([recurso comment](https://developers.google.com/youtube/v3/docs/comments)) | não entra. Nenhuma tela usa a palavra "coração" |
| 9 | **(d) comentário fixado** | **Não existe.** Nenhum campo de fixado nos recursos `comment` e `commentThread` | não entra. É comum o fixado ser o do próprio criador, e esse é pego pela linha 7; um comentário de terceiro fixado pelo criador **não é distinguível** |
| 10 | "Canal verificado" | **Não existe.** O recurso `comment` não diz nada sobre o autor além de nome, foto, URL e id do canal; o recurso `channel` não tem campo de selo de verificação (a única menção a "verification" é a verificação por telefone para envio de vídeos longos, em `status.longUploadsStatus`) ([recurso comment](https://developers.google.com/youtube/v3/docs/comments), [recurso channel](https://developers.google.com/youtube/v3/docs/channels)) | o critério do dono **não pode ser cumprido como dito**. Substitutos em 4.6.2 (pergunta 9) |
| 11 | Comentários desligados | erro `commentsDisabled` (403): "The video identified by the videoId parameter has disabled comments" ([commentThreads.list](https://developers.google.com/youtube/v3/docs/commentThreads/list)) | vira o estado `desligados` da coleta e confirma o sinalizador `comments_disabled` da E1. **Nunca zero** |
| 12 | Outros erros | `videoNotFound` (404); `forbidden` (403); `processingFailure` (histórico de revisões, 16/03/2016) | `videoNotFound` não grava nada (o sumiço é da E1); os demais gravam `erro` com o motivo |
| 13 | Chave de API basta? | **NC.** As páginas lidas só exigem OAuth para inserir, alterar e apagar ([guia de comentários](https://developers.google.com/youtube/v3/guides/implementation/comments)); não achei a frase que diga que a leitura por `videoId` aceita chave | a chamada de leitura responde. Se exigir acesso autorizado, **a etapa para e volta ao dono**: o dado passaria a ser lido com a conta dele, o que muda a natureza da coleta |
| 14 | Conferir se um comentário ainda existe | `comments.list?id=` aceita "a comma-separated list of comment IDs"; erro `commentNotFound` (404): "One or more of the specified comments cannot be found"; e um erro `operationNotSupported` cujo texto fala de comentários "based on Google+" ([comments.list](https://developers.google.com/youtube/v3/docs/comments/list)). **NC:** quantos ids por chamada; se um id ausente derruba a chamada inteira (404) ou só some da lista; se o filtro por id funciona para comentário de vídeo | a chamada de leitura responde (um id real e um inventado na mesma chamada). Pior caso: uma chamada por comentário guardado (até 12 unidades por vídeo e marco, em vez de 1) |
| 15 | Por que um comentário some | a API devolve a mesma ausência para comentário apagado pelo autor, removido pelo criador, retido pelo YouTube ou de conta encerrada; `moderationStatus` só vem para o dono do canal ([recurso comment](https://developers.google.com/youtube/v3/docs/comments)) | "motivo: o YouTube não diz", como na fila de 4.5 |

**Resumo dos três critérios do dono.** *Mais curtidos:* sim, entre os 100 primeiros por relevância, ordenados por nós. *Interagido pelo criador:* sim para "o criador escreveu" e "o criador respondeu" (com a lacuna da linha 6); **não** para coração e para fixado. *Canal verificado:* **não existe na API.**

#### 4.6.2 "Canal verificado": os substitutos honestos e a escolha do dono (emenda v2.2: opção C, redesenhada)

| Opção | O que é | Custo | A favor | Contra |
|---|---|---|---|---|
| **A. Canal que o Observatório acompanha** | o autor do comentário (ou de uma resposta vista) é um dos canais cadastrados: concorrentes ou os do dono | 0 unidade; **nenhum dado novo de terceiros** (a comparação é feita na coleta e só o vínculo com o canal já cadastrado é gravado) | exato, explicável ("comentou aqui: canal X, que você acompanha") e responde a uma pergunta real: os criadores do nicho conversam entre si? | raro: com 15 canais, quase nenhum vídeo terá um. Não é "verificado" |
| **B. Autor com muitos inscritos** | `channels.list?part=statistics` para os autores do lote (50 ids por chamada, 1 unidade), e "de destaque" = inscritos ≥ um limiar (por exemplo 10.000) | até 2 unidades por vídeo e marco; traz **mais dado de terceiros** (o número de inscritos de até 100 pessoas por vídeo, a maioria gente comum) | aproxima "canal relevante" | inscritos vêm arredondados e podem estar ocultos ("não medido"); o limiar é arbitrário; é exatamente o tipo de dado que a minimização manda não buscar; não é "verificado" |
| **C. A + B** | A sempre; B só para os autores dos 20 mais curtidos do lote | até 1 unidade por vídeo e marco | menos dado de terceiros que B | os mesmos de B, em menor escala |
| **D. Abandonar o critério** | as vagas dele vão para "mais curtidos" | 0 | nada é prometido que a API não dê | perde a ideia de "quem é relevante comentou" |

**Decisão do dono (12/10, itens 25 e 26 do arquivo de decisões):** o que ele quer ver é "o MrBeast comentou num canal menor", "o Neymar Jr comentou no canal de alguém"; "se não dá, vamos fazer o mais próximo disso, como você recomendar". A API não diz quem é famoso nem quem é verificado (linha 10 de 4.6.1); o mais próximo que ela dá é **o tamanho do canal de quem comentou**. Fica a opção C, com a regra abaixo. A tela **nunca** usa a palavra "verificado" nem "famoso": diz "canal grande" e mostra a base.

**A regra do autor de destaque (parâmetros em `rules.ts`; todos [DONO], pergunta 26).** Um comentário de topo tem autor de destaque quando vale (a) **ou** (b):

- **(a) Canal acompanhado.** O `authorChannelId` do comentário (ou de uma resposta vista) é um canal cadastrado no Observatório, concorrente ou do dono. Custo zero; nenhum dado novo de terceiros. Grava `featured_reason = 'canal_acompanhado'` e `featured_channel_id`.
- **(b) Canal grande para o lugar onde comentou.** Os inscritos do canal do autor são **pelo menos 100.000** (`commentsFeaturedMinSubs`) **e pelo menos 10 vezes** os inscritos do canal do vídeo (`commentsFeaturedMinRatio`). As duas condições juntas são o que ele descreveu: "grande" sozinho marcaria todo comentário de canal médio num canal gigante; "muito maior" sozinho marcaria um canal de 3 mil inscritos comentando num de 200. Grava `featured_reason = 'inscritos'`, a faixa de tamanho e a faixa da razão (4.6.6, ponto 3).

**Como (b) é consultado, e o custo conferido na documentação.** `channels.list?part=statistics&id=<ids>` custa 1 unidade por chamada ([custo de cota](https://developers.google.com/youtube/v3/determine_quota_cost)) e aceita uma lista de ids separados por vírgula ([channels.list](https://developers.google.com/youtube/v3/docs/channels/list); **NC:** o máximo de ids por chamada, que este spec assume ser 50 como em `videos.list`; a chamada de leitura do item 107 confirma). A consulta é feita **só para os autores dos 20 comentários de topo mais curtidos do lote** (`commentsFeaturedLookup = 20`), fora os que já são o criador ou um canal acompanhado: **uma chamada, 1 unidade por vídeo e marco**. Por canal e dia: 98 vídeos × 3 marcos ÷ 365 = **0,81 unidade** (9.5). Aumentar para 50 autores custa a mesma unidade; fica em 20 por minimização (menos gente consultada) e é parâmetro.

**O que a regra não vê, dito na tela (ⓘ):**

1. **Canal grande cujo comentário teve poucas curtidas** e ficou fora dos 20 mais curtidos, ou fora dos 100 primeiros por relevância: não é consultado e não é marcado. A frase da tela diz "entre os 20 mais curtidos".
2. **Inscritos ocultos.** `statistics.hiddenSubscriberCount` verdadeiro ([recurso channel](https://developers.google.com/youtube/v3/docs/channels)): o tamanho **não se sabe**; o autor não é marcado e o retrato conta quantos ficaram nesse estado (`featured_unknown_n`). Nunca é lido como "pequeno".
3. **Inscritos do canal do vídeo ocultos ou ausentes** (o número vem de `competitor_channels`, já coletado): a razão não se sabe; vale só o piso de 100 mil e a faixa da razão fica nula, lida como "razão não medida: inscritos do canal ocultos".
4. **O número de inscritos que a API devolve é arredondado** ([recurso channel](https://developers.google.com/youtube/v3/docs/channels), `statistics.subscriberCount`; **NC** a regra exata de arredondamento para chave de API, que a documentação descreve como três algarismos significativos): as comparações usam o número como veio; um canal na borda de uma faixa pode cair na vizinha.
5. **Pessoa famosa sem canal grande** (quem comenta de uma conta pessoal pequena) não aparece. "Famoso" não é um dado.
6. **Autor sem `authorChannelId`** (vem "if available", linha 3 de 4.6.1): não consultado, contado em `featured_unknown_n`.
7. **Homônimo e conta falsa:** o tamanho do canal é o filtro; um canal de 12 inscritos chamado "MrBeast" não passa do piso. O nome nunca entra na regra.

**Quem tem preferência nas 2 vagas:** primeiro os de (a); depois os de (b), da faixa de tamanho maior para a menor; empate, a ordem de 4.6.3 (curtidas, respostas, posição, id).

#### 4.6.3 A regra de seleção (reproduzível, explicável na tela)

Parâmetros em `rules.ts`: `commentsTarget = 12` (o alvo do dono), `commentsCreatorMax = 4`, `commentsFeaturedMax = 2`, `commentsPool = 100`, `commentsCreatorRepliesMax = 3`, e os três do autor de destaque (4.6.2): `commentsFeaturedLookup = 20`, `commentsFeaturedMinSubs = 100000`, `commentsFeaturedMinRatio = 10`. **A divisão foi aprovada pelo dono em 12/10** (item 26 do arquivo de decisões): até 4 com o criador, até 2 de autor de destaque, o resto mais curtidos.

1. **Lote.** Uma chamada: `commentThreads.list?part=snippet,replies&videoId=…&order=relevance&maxResults=100&textFormat=plainText`. As até 100 conversas devolvidas são o lote. Cada uma recebe a **posição** em que veio (1 a 100).
2. **Sinalizadores de cada conversa**, calculados na coleta: `do_criador` (o comentário de topo é do canal do vídeo); `criador_respondeu` (`sim`: há resposta do canal do vídeo entre as respostas vistas; `não`: todas as respostas foram vistas e nenhuma é dele; `não se sabe`: vieram menos respostas que `totalReplyCount` e nenhuma das vistas é dele); `autor_de_destaque` (regra de 4.6.2: canal acompanhado, ou canal com 100 mil inscritos ou mais e 10 vezes o canal do vídeo; a consulta de inscritos é uma chamada a mais, feita depois de ordenar o lote por curtidas).
3. **Três grupos, preenchidos nesta ordem, cada comentário em um só:**
   - **Criador** (até 4): conversas com `do_criador` ou `criador_respondeu = sim`.
   - **Autor de destaque** (até 2): conversas com `autor_de_destaque`, fora as já escolhidas.
   - **Mais curtidos** (o que faltar para 12): as demais, por curtidas.
4. **Ordem dentro de cada grupo e desempate, sempre os mesmos:** `likeCount` do comentário de topo, do maior para o menor; empate, `totalReplyCount` maior; empate, posição menor na relevância; empate, id do comentário em ordem alfabética. Com a mesma resposta da API, a seleção é sempre a mesma (item de aceite 109).
5. **Sobreposição.** Um comentário que é o mais curtido **e** tem resposta do criador entra uma vez, no grupo "criador", e leva os dois sinalizadores; a vaga de "mais curtidos" passa ao seguinte. A tela mostra os sinalizadores, não o grupo: o grupo só explica por que ele foi escolhido.
6. **Falta.** Vaga não preenchida de "criador" ou "destaque" vai para "mais curtidos". Lote com menos de 12 conversas: grava todas. Lote vazio: 4.6.5.
7. **O que acompanha o comentário escolhido:** até 3 respostas **do criador** naquela conversa (as mais antigas entre as vistas), com o texto. **Nenhuma resposta de outra pessoa é gravada.**
8. **Frase da tela** (o mockup fecha o texto): "12 comentários de 100 lidos por relevância · 6 mais curtidos · 4 com o criador · 1 de canal que você acompanha · 1 de canal grande (entre os 20 mais curtidos)". Com lote completo: "de todos os 37 comentários". O ⓘ explica a regra e o que ela não garante (linha 1 de 4.6.1).

**Vale para longos e para Shorts** (61% dos vídeos guardados são Shorts), com a mesma regra [DONO, pergunta 12]. Ao vivo e estreia: comentário de vídeo entra; o **chat** da transmissão não é comentário e continua fora (12.1).

#### 4.6.4 Quando coletar

Comentário muda: curtidas sobem, o criador responde depois, gente apaga. **Um retrato em cada marco de idade do vídeo: 1, 7 e 30 dias**, os mesmos de `competitor_video_marks` (seção 5), para que views, curtidas e comentários de um vídeo sejam lidos na mesma idade.

- **Quando roda:** na primeira sincronização diária (12:00 de São Paulo) em que o vídeo tem a idade do marco e ainda não tem o retrato dele. A idade real na coleta é gravada em horas.
- **Tolerância:** o marco 1 vale até a idade de 3 dias; o 7, até 10; o 30, até 37. Passou disso, o retrato **não é feito** e a tela diz "não coletado na idade N" (com o motivo: "descoberto tarde" ou "coleta falhou em dd/mm"). Um retrato tirado fora da idade com o rótulo do marco seria dado falso.
- **Vídeo com `comments_disabled` (E1):** a chamada é feita mesmo assim no marco (1 unidade), porque confirma o motivo; o estado gravado é `desligados`.
- **Vídeo com `missing_since`:** não se coleta.
- **Conferência do que já está guardado.** Nos marcos 7 e 30, todo comentário guardado do vídeo que **não** voltou no lote é conferido por id (`comments.list?id=`, linha 14 de 4.6.1): se vier, atualiza curtidas e texto; se não vier, ganha `missing_since` (4.6.7). **Depois do marco 30 nada é relido** nesta proposta; a alternativa de reconferir todo mês está na pergunta 13, e a falta dela é o risco 21.
- **Teto e registro.** O passo tem teto de tempo próprio dentro do cron e de chamadas por execução (`RULES.commentsCallsMax`, proposto 60); o que não coube entra primeiro na execução seguinte, **e a execução registra quantos ficaram para trás** (em `youtube_quota_usage.operations` e no retorno do cron). Corte silencioso é proibido. O plano mede o tempo com 75 canais simulados antes de promover, como na E2.
- **Retroação:** padrão **nenhuma**: só vídeos que fazem 1, 7 ou 30 dias depois do deploy. A alternativa (um retrato avulso, de hoje, dos 1.389 vídeos já guardados; marco `0`, "lido em dd/mm, com N dias de idade") é a pergunta 12.

#### 4.6.5 Os estados da coleta (nunca verde por falta)

Um retrato tem sempre uma linha com o estado. **Sem linha = "não coletado"**, que a tela distingue dos outros três.

| Estado | Quando | Na tela |
|---|---|---|
| `ok` | a API devolveu pelo menos uma conversa | os comentários, com "N de M lidos" |
| `sem_comentarios` | resposta 200 com zero conversas **e** a contagem do vídeo (`commentCount` da mesma sincronização) é 0 | "nenhum comentário aos N dias" |
| `desligados` | erro `commentsDisabled` | "comentários desligados pelo canal" |
| `erro` | qualquer outra falha, **ou** zero conversas com `commentCount` maior que 0 (a contagem diz que há e a lista veio vazia: não é "sem comentários") | "não coletado: <motivo>", com nova tentativa dentro da tolerância |
| (sem linha) | o marco ainda não chegou, passou da tolerância, ou a etapa não existia | "fecha em dd/mm", "não coletado na idade N", ou "a coleta de comentários começou em dd/mm" |

#### 4.6.6 O que gravar e o que não gravar

| Grava | Por quê |
|---|---|
| texto do comentário (`textDisplay` em texto puro, até 2.000 caracteres; o que passar é cortado e marcado) | é o dado |
| curtidas, número de respostas e posição na relevância, **por marco** | "o que subiu entre o dia 1 e o dia 30" |
| data de publicação e de edição do comentário | ordem dos fatos; "editado" |
| os sinalizadores: do criador, o criador respondeu (sim, não, não se sabe), autor de destaque | os critérios do dono |
| o grupo pelo qual foi escolhido, por marco | explica a seleção |
| o texto de até 3 respostas **do criador** | "como ele conversa com o público": é o que tem valor, e é fala pública do dono do canal acompanhado |
| o id do comentário no YouTube | única forma de não duplicar entre marcos e de conferir se foi apagado. É um identificador que leva ao comentário público: conta como dado pessoal indireto |
| a idade do vídeo na coleta, o tamanho do lote, se o lote era o vídeo inteiro, a versão e os parâmetros da regra | reproduzir e explicar a amostra |

| **Não grava, ou grava com prazo** | Por quê |
|---|---|
| **identidade do autor além de 28 dias** (nome, id do canal, foto) | **decisão do dono (12/10), abaixo:** fica 28 dias e é apagada; o texto fica |
| o arquivo da foto de perfil | guarda-se só a **URL** (`authorProfileImageUrl`), nunca uma cópia: uma cópia no Blob teria URL pública e seria mais um lugar de onde apagar; com a URL, apagar a coluna basta. Custo: se o autor trocar a foto, a URL pode quebrar antes dos 28 dias, e a tela mostra a inicial |
| a URL do canal do autor (`authorChannelUrl`) | deriva do id |
| respostas de quem não é o criador | fora do pedido; multiplicaria o volume e o dado pessoal |
| o lote inteiro (os até 100) e a resposta bruta da API | **não vai para `competitor_raw`**: guardaria texto, nome, foto e id de até 100 pessoas por vídeo para usar 12 |
| versões antigas de um comentário editado | fica o texto da última leitura e a data de edição |
| imagem anexada ao comentário, se a API a devolver | fora do pedido |

**Identidade do autor: 28 dias, depois apagada (decisão do dono, 12/10; responde à pergunta 15).** "Para a LGPD ficar feliz, vamos guardar o nome + comentário e foto pelos 30 dias, ou seja, uns 28 dias a gente guarda, depois deleta estes dados e fica nullable ou algo assim. A gente lê o comentário, mas não sabe de quem foi." É um **desenho de minimização decidido pelo dono**, registrado como tal, sem parecer jurídico. O limite dele está no risco 19: é pseudonimização, não anonimização.

1. **O que expira:** `author_display_name`, `author_channel_id` e `author_avatar_url`, três colunas anuláveis, com `author_expires_at` = primeira coleta do comentário + `RULES.commentsIdentityDays` (28). O que **fica**: texto, datas, contagens por marco, sinalizadores e o id do comentário.
2. **O prazo não se renova.** Conta da **primeira** vez em que o comentário foi gravado. Um comentário visto no marco 1 perde a identidade na idade 29 do vídeo; quando ele volta no lote do marco 30, **a identidade não é regravada** (a coluna `author_purged_at` preenchida impede: item de aceite 126). Sem isso, cada marco reiniciaria o relógio e o nome ficaria até 58 dias.
3. **O sinalizador é resolvido antes, na própria coleta.** `is_creator`, `creator_replied`, `featured_reason` e `featured_channel_id` são calculados e gravados na mesma transação em que o comentário entra. A rotina de apagar nunca precisa da identidade para decidir nada: a identidade some, o sinalizador fica. **O que fica do autor de destaque depois dos 28 dias (emenda v2.2):** `featured_reason`, a **faixa de tamanho** do canal do autor (`featured_size_band`: `100k_1m`, de 100 mil a 1 milhão; `1m_10m`, de 1 a 10 milhões; `10m_mais`, mais de 10 milhões) e a **faixa da razão** para o canal do vídeo (`featured_ratio_band`: `10x_100x`, `100x_1000x`, `1000x_mais`; nula quando a razão não se sabe). **O número de inscritos do autor e a razão exata nunca são gravados, nem nos primeiros 28 dias:** são usados na coleta e descartados. O motivo é reidentificação: a razão exata vezes os inscritos do canal do vídeo, que guardamos, devolve o número de inscritos do autor com três algarismos, e esse número, sozinho, aponta para um canal ou para poucos. Pelo mesmo motivo **não há faixa acima de "mais de 10 milhões"**: uma faixa "mais de 100 milhões" teria um punhado de canais no mundo e equivaleria ao nome. As faixas e os limites são gravados em `rule_params` do retrato, para que uma mudança de parâmetro não reescreva a leitura antiga.

   **O limite, sem suavizar.** (i) Depois do prazo o sistema **não sabe mais quem foi**: "o MrBeast comentou", com nome e foto, só existe na tela nos primeiros 28 dias; depois ela diz "um canal com mais de 10 milhões de inscritos comentou (mais de 1.000 vezes o tamanho deste canal)". Não há como recuperar o nome a partir do que ficou, e isso é o que o dono pediu. (ii) **A faixa estreita o conjunto de pessoas possíveis:** "mais de 10 milhões" são alguns milhares de canais; somada ao texto, à data e ao vídeo, deixa quem abrir o vídeo no YouTube achar o comentário e o autor enquanto ele estiver lá. É a mesma pseudonimização do risco 19, com um atributo a mais; o risco 27 registra.
4. **O criador não é anonimizado.** Comentário e resposta do canal do vídeo (`is_creator`) nunca têm as três colunas preenchidas: o autor é o canal acompanhado, dado público do próprio concorrente, e o nome e a imagem vêm de `competitor_channels`. **A exceção, a confirmar pelo dono (pergunta 21): o canal acompanhado que comentou** (`featured_channel_id`, regra (a) de 4.6.2). As três colunas de identidade dele são anuladas aos 28 dias como as de qualquer um, mas **o vínculo com o cadastro fica para sempre**, e a tela continua dizendo "comentou aqui: canal X, que você acompanha". O argumento: é o próprio concorrente, um canal que o dono escolheu acompanhar, cujo nome, imagem e números públicos o Observatório já guarda sem prazo. O contra-argumento, para ele pesar: é a única identidade de comentarista que sobrevive aos 28 dias, e "quem comentou onde" é um dado novo sobre esse canal, que o cadastro não tinha. Se a resposta for "não", `featured_channel_id` é anulado pela mesma rotina e fica só `featured_reason = 'canal_acompanhado'` ("um canal que você acompanha comentou"); é uma linha na função e um item de aceite (148). Padrão: fica.
5. **A rotina.** Uma função `competitor_comment_identity_purge()` (security definer, `search_path` fixo, `execute` só para `service_role`), chamada todo dia como tarefa `anular_identidade` da agenda única (4.8; emenda v2.2: nenhuma entrada de cron nova): anula as três colunas e grava `author_purged_at` onde `author_expires_at <= now()` e alguma delas ainda tem valor. **Idempotente:** rodar duas vezes seguidas altera zero linhas na segunda. Devolve quantas linhas anulou e **quantas estavam vencidas há mais de um dia** (o sinal de que ela deixou de rodar).
6. **Falha em vermelho.** A rotina tem chave própria em `cron_health` (`competitor-comment-identity`); 36 horas sem sucesso é falha no vigia que já existe. E, independente dela, o passo de coleta de comentários roda no começo a consulta de prova do item 125: se houver identidade com mais de 29 dias, a execução devolve `status: 'error'`, **não coleta comentário novo** e o cabeçalho do Observatório mostra "identidade de autores vencida e não apagada: N" para quem edita. Não coletar é de propósito: sem a rotina, cada coleta aumentaria o que está fora da regra.
7. **Na leitura:** os leitores de tela nunca devolvem identidade com `author_expires_at` vencido, mesmo que a rotina tenha falhado (defesa a mais; o alerta do passo 6 continua aparecendo).
8. **Fora do banco:** o export de 9.2 **nunca** leva as três colunas (o `SELECT` do export não as lê; item 127); nenhum log grava nome, id ou URL de foto; nenhum pacote do pipeline as contém.
9. **Na tela (4.6.9):** enquanto a identidade existe, o comentário mostra nome e foto com "identidade guardada até dd/mm"; depois, "um espectador", ou, para o autor de destaque, a faixa: "um canal com mais de 10 milhões de inscritos" (nunca o nome), ou o nome do canal acompanhado (pergunta 21).

#### 4.6.7 DDL proposto (migration MG8) e o histórico

**Histórico: o texto fica uma vez; as contagens ficam por marco.** Regravar o texto em cada marco triplicaria a maior parcela para guardar a mesma frase; atualizar tudo na mesma linha perderia o que mudou entre o dia 1 e o dia 30. Por isso três tabelas: o retrato (uma linha por vídeo e marco), o comentário (uma linha por comentário, com o texto da última leitura) e a leitura (uma linha por comentário e marco).

```sql
-- 1. O retrato: uma linha por vídeo e marco. É ela que separa "sem comentários", "desligados", "erro" e "não coletado" (sem linha).
create table if not exists public.competitor_video_comment_snaps (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  mark smallint not null check (mark in (0, 1, 7, 30)),      -- idade em dias; 0 = leitura avulsa (só se a pergunta 12 for "sim")
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  taken_at timestamptz not null,
  video_age_hours numeric not null,
  status text not null check (status in ('ok', 'sem_comentarios', 'desligados', 'erro')),
  error_reason text,                    -- só com status = 'erro'
  pool_size smallint,                   -- conversas devolvidas (0 a 100); nulo se a chamada falhou
  pool_complete boolean,                -- a resposta veio sem nextPageToken: o lote é o vídeo inteiro
  video_comment_count bigint,           -- commentCount do vídeo na mesma sincronização; nulo = ausente
  selected_count smallint,
  featured_lookup_n smallint,           -- autores consultados em channels.list neste retrato (0 a 20); nulo = a consulta falhou
  featured_unknown_n smallint,          -- consultados cujo tamanho não se sabe (inscritos ocultos, sem id de canal)
  rule_version smallint not null,
  rule_params jsonb not null,           -- alvo, tetos por grupo, tamanho do lote, critério de "destaque" em vigor
  units_used smallint not null,
  primary key (video_id, mark)
);
create index if not exists idx_cvcs_channel_taken on public.competitor_video_comment_snaps (competitor_channel_id, taken_at);

-- 2. O comentário: uma linha por comentário guardado; o texto é o da última leitura.
create table if not exists public.competitor_video_comments (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  youtube_comment_id text not null,
  parent_id bigint references public.competitor_video_comments(id) on delete cascade,  -- nulo = comentário de topo; preenchido = resposta DO CRIADOR a ele
  body text not null,                    -- textDisplay em texto puro, até 2.000 caracteres
  body_truncated boolean not null default false,
  published_at timestamptz not null,
  edited_at timestamptz,                 -- updatedAt, quando diferente de publishedAt
  is_creator boolean not null,           -- o autor é o canal do vídeo (sempre true quando parent_id não é nulo)
  creator_replied boolean,               -- só no topo; nulo = não se sabe (respostas vieram cortadas e nenhuma vista é dele)
  featured_reason text check (featured_reason in ('canal_acompanhado', 'inscritos')),  -- nulo = não é de destaque (4.6.2)
  featured_channel_id uuid references public.competitor_channels(id) on delete set null,  -- regra (a): o canal acompanhado que comentou; fica depois dos 28 dias (pergunta 21)
  featured_size_band text check (featured_size_band in ('100k_1m', '1m_10m', '10m_mais')),      -- regra (b): faixa de inscritos do autor; o número exato nunca é gravado
  featured_ratio_band text check (featured_ratio_band in ('10x_100x', '100x_1000x', '1000x_mais')),  -- regra (b): faixa da razão para o canal do vídeo; nulo = razão não se sabe
  author_display_name text,              -- identidade do autor: as três colunas são anuladas aos 28 dias (4.6.6); sempre nulas quando is_creator
  author_channel_id text,
  author_avatar_url text,                -- só a URL; nenhum arquivo é copiado
  author_expires_at timestamptz,         -- first_seen_at + 28 dias; não se renova
  author_purged_at timestamptz,          -- preenchido pela rotina; impede regravar a identidade num marco posterior
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,     -- última leitura em que o comentário VEIO
  missing_since date,                    -- 1ª conferência por id sem ele; nulo = veio
  removal_decision text check (removal_decision in ('manter')),
  removal_decided_at timestamptz,
  removal_decided_by uuid,
  unique (video_id, youtube_comment_id),
  check (not is_creator or (author_display_name is null and author_channel_id is null and author_avatar_url is null)),
  check ((featured_size_band is null and featured_ratio_band is null) or featured_reason = 'inscritos'),
  check (featured_channel_id is null or featured_reason = 'canal_acompanhado'),
  check (author_purged_at is null or (author_display_name is null and author_channel_id is null and author_avatar_url is null))
);
create index if not exists idx_cvc_identity_due on public.competitor_video_comments (author_expires_at)
  where author_display_name is not null or author_channel_id is not null or author_avatar_url is not null;
create index if not exists idx_cvc_channel on public.competitor_video_comments (competitor_channel_id, first_seen_at);
create index if not exists idx_cvc_missing on public.competitor_video_comments (site_id, missing_since) where missing_since is not null and removal_decision is null;

-- 3. A leitura: uma linha por comentário e marco.
create table if not exists public.competitor_video_comment_marks (
  comment_id bigint not null references public.competitor_video_comments(id) on delete cascade,
  mark smallint not null check (mark in (0, 1, 7, 30)),
  site_id uuid not null references public.sites(id) on delete cascade,
  likes integer not null,
  reply_count integer,                   -- só no topo
  relevance_rank smallint,               -- posição 1 a 100 no lote; nulo = fora do lote, lido por id
  slot text check (slot in ('criador', 'destaque', 'curtidos')),  -- nulo = não escolhido neste marco (lido só para acompanhar)
  primary key (comment_id, mark)
);

alter table public.competitor_video_comment_snaps enable row level security;
alter table public.competitor_video_comments enable row level security;
alter table public.competitor_video_comment_marks enable row level security;
drop policy if exists "competitor_video_comment_snaps_select" on public.competitor_video_comment_snaps;
create policy "competitor_video_comment_snaps_select" on public.competitor_video_comment_snaps
  for select using (public.can_view_site(site_id));        -- só estado e contagens: mesmo nível das outras tabelas
drop policy if exists "competitor_video_comments_select" on public.competitor_video_comments;
create policy "competitor_video_comments_select" on public.competitor_video_comments
  for select using (public.can_edit_site(site_id));        -- texto de terceiros: nível do raw, não o de leitura
drop policy if exists "competitor_video_comment_marks_select" on public.competitor_video_comment_marks;
create policy "competitor_video_comment_marks_select" on public.competitor_video_comment_marks
  for select using (public.can_edit_site(site_id));
```

- **RLS (diverge de D6 de propósito):** o texto e as leituras por comentário usam `can_edit_site`, não `can_view_site`. `can_view_site` confia no GUC `app.site_id`, que o cliente pode forjar (regra do projeto para leitura sensível); dado pessoal de terceiros é leitura sensível. O retrato, que só tem estado e contagens, fica em `can_view_site`. Nenhuma policy de escrita (só service role). Os leitores de tela usam o mesmo token de edição dos termos de pesquisa (7.3): usuário só de leitura vê o estado e as contagens, **não o texto**.
- **Escrita atômica:** uma função `apply_competitor_comment_snap(p_video uuid, p_mark smallint, p_snap jsonb, p_comments jsonb)` (security invoker, `search_path` fixo, `execute` só para `service_role`) grava o retrato, os comentários e as leituras na mesma transação. Retrato sem os comentários dele, ou o contrário, não existe.
- **Comentário que deixou de vir (apagado, removido, retido: a API não diz qual).** Marca `missing_since` na **segunda** conferência seguida sem ele quando há duas (entre os marcos 7 e 30); no marco 30, que é a última, uma ausência basta e a tela diz "uma conferência só". **Proposta: vai para a mesma fila "Saíram do YouTube" (4.5), com a mesma regra do dono** (sem resposta, o dado fica; ele decide entre manter e apagar), **agrupado por vídeo** ("3 comentários deste vídeo não vieram mais"), para a fila não virar uma lista de centenas de linhas. "Apagar" remove a linha (as leituras caem em cascata) e deixa em `competitor_removed_items` só o id (acrescentar `'comentario'` ao `check` de `kind`). **O spec propõe isto porque foi a regra que o dono deu para vídeo; para comentário de pessoa comum a alternativa mais prudente é apagar o texto sozinho quando ele deixa de vir, sem pergunta. É a pergunta 14.**
- **O que apaga os comentários junto:** a resposta "apagar" de um vídeo (4.5) e a remoção de um canal levam os comentários por cascata; `competitor_video_purge` e `competitor_channel_removal_impact` passam a contar as três tabelas.
- **Export (9.2):** as três tabelas entram no export por canal e mês. O arquivo no NAS passa a conter texto de terceiros; uma decisão de apagar alcança o arquivo pelos mesmos comandos de expurgo.
- **Zero × não medido:** `creator_replied` nulo é "não se sabe", nunca "não". `likes` é sempre número (a API devolve `likeCount` para comentário; se vier ausente, a leitura não é gravada e a execução registra).

#### 4.6.8 Para que serve, e o que se mede sem IA

Perguntas que o dono passa a responder sobre um vídeo de concorrente, lendo: **o que o público destacou** (os mais curtidos), **do que reclamou ou o que pediu** (idem; a leitura é dele), **o que o criador escolheu responder e como** (as conversas com resposta dele e o texto dela), **quem do nicho apareceu** (opção A).

Duas medidas entram na etapa E4, com as regras comuns da seção 5 (estado medido ou não medido com motivo; cálculo nosso, dito no ⓘ; longos e Shorts separados):

| # | Medida | Definição exata | Janela | "Não medido" quando | Viés dito na tela |
|---|---|---|---|---|---|
| **M11** | **O criador responde** | fração dos vídeos do canal com retrato `ok` no marco 30 em que pelo menos um dos comentários guardados tem `criador_respondeu = sim`. Sempre "5 de 14"; percentual só com 10 ou mais | publicados nos últimos 90 dias | menos de 5 vídeos com retrato `ok` no marco 30; a coleta começou há menos de 30 dias ("fecha em dd/mm") | **é um piso:** só vê as respostas dele nos cerca de 12 comentários guardados e nas respostas que a API devolveu; "não respondeu" em tela é sempre "não vimos resposta". Canal que responde a todos e canal que responde só aos mais curtidos dão o mesmo número |
| **M12** | **Peso do comentário de topo** | curtidas do comentário mais curtido do retrato ÷ curtidas do vídeo na mesma idade (`competitor_video_marks.likes`), por vídeo; do canal, a mediana | marcos 7 e 30 | curtidas do vídeo ocultas; retrato diferente de `ok`; vídeo com menos de 100 curtidas | "mais curtido **entre os lidos**"; um comentário polêmico e um elogio dão o mesmo número: a medida diz que um comentário concentrou atenção, não se foi bom ou ruim |

Ressalva de política: III.E.4.h dá como exemplo do que não é permitido usar "the number of likes returned in the API Data to calculate other metrics"; M12 é exatamente esse caso, como M7 já era. Entra no mesmo risco de 11.1 (medida própria, com aviso), e pode ser cortada sem afetar o resto.

**Leitura do texto por IA: decisão à parte, não desta fase.** Classificar tema, tom ou pedido de cada comentário é o passo natural e fica **registrado como opção**. Ressalvas para quando for decidido: (1) **texto de terceiro não entra em pacote da forja nem do Cowork sem o dono decidir** (padrão desta emenda: não entra; seção 8); (2) as duas rotas não são iguais: a forja roda um modelo local, na casa do dono, e o texto não sai de lá; o Cowork é um modelo na nuvem, e mandar o texto para ele é entregar dado pessoal de terceiros a mais um operador; (3) comentário é texto escrito por desconhecidos e pode conter instrução dirigida ao modelo ("ignore o que veio antes…"): qualquer leitura por IA trata o texto como dado, nunca como instrução, e o validador confere o que o modelo citar contra o texto guardado.

#### 4.6.9 Tela: o que o mockup 20 tem de considerar (seção 6.5)

1. **O texto é de terceiros e não foi filtrado:** pode ser ofensivo, conter palavrão, discurso de ódio, spam, golpe, e-mail ou telefone. A tela mostra como veio (é o dado), sem destaque de cor para o conteúdo, e **nunca** como link clicável: endereço dentro do texto é texto.
2. **Pode ser longo** (até 2.000 caracteres guardados, com a marca "cortado"): mostrar poucas linhas com "ver tudo", sem empurrar o resto da página; a 390 px, sem rolagem horizontal mesmo com palavra longa ou endereço.
3. **Outro idioma, emoji, texto da direita para a esquerda, sequências de emoji:** sem tradução automática; a fonte tem de cobrir emoji; `dir="auto"` no bloco do texto.
4. **Os três estados sem comentário, mais o quarto,** cada um com cor e símbolo próprios (regra do dono): "nenhum comentário aos N dias" (zero medido), "comentários desligados pelo canal" (não medido, motivo do canal), "não coletado" (não medido, motivo nosso, com a data), e "fecha em dd/mm" (o marco ainda não chegou).
5. **O comentário pode ter saído depois:** pastilha "não veio mais do YouTube desde dd/mm" (o YouTube não diz por quê), e o atalho para a fila.
6. **A amostra é dita no topo, sempre:** "12 de 100 lidos por relevância" ou "todos os 37"; e por que cada um está ali (mais curtido, com o criador, canal que você acompanha) por cor **e** símbolo.
7. **Três idades:** o retrato de 1, 7 e 30 dias como abas ou como uma linha por comentário com as curtidas nas três idades; o que entrou e o que saiu do topo entre uma e outra.
8. **A resposta do criador** aparece presa ao comentário a que responde, com a marca do canal dele; "o criador respondeu: não se sabe" tem forma própria e não se confunde com "não respondeu".
9. **Autor de destaque (emenda v2.2):** cor **e** símbolo próprios para "canal grande" e para "canal que você acompanha"; a base ao lado, sempre em faixa ("mais de 10 milhões de inscritos · mais de 1.000 vezes este canal"), e o ⓘ com a regra e os sete limites de 4.6.2. Os dois momentos do mesmo comentário lado a lado no mockup: com nome e foto (até dd/mm) e, depois, "um canal com mais de 10 milhões de inscritos comentou". "Razão não medida" tem forma própria. Caso magro, que é o comum: nenhum autor de destaque no vídeo, dito como "nenhum canal grande entre os 20 mais curtidos" e não como ausência muda.
9b. **Dois estados do autor:** com identidade (nome, foto pela URL, e "identidade guardada até dd/mm"; foto que não carrega vira a inicial) e sem identidade ("um espectador"), que é o estado de quase todo comentário com mais de 28 dias. O criador e o canal acompanhado aparecem sempre com nome, vindos do cadastro. A foto é carregada direto do YouTube pelo navegador de quem vê; não há cópia nossa.
10. **Quem vê:** só quem edita o site. Usuário só de leitura vê a contagem e o estado, não o texto, e a tela diz que há texto que ele não vê (não é tela vazia).
11. **Onde aparece:** na página do vídeo de concorrente (mockup 13 ganha a seção, desenhada no 20); na página do canal, M11 no cabeçalho e uma lista "o que o criador respondeu"; nada na lista de Canais nem em Comparar nesta fase.
12. Acrescenta à lista fechada de motivos de 6.1.5: "comentários desligados pelo canal" (já existia para a contagem), "a coleta de comentários começou em dd/mm", "não coletado na idade N", "o YouTube não diz se o criador respondeu (respostas cortadas)".

## Itens de aceite deste arquivo (blocos da seção 10 do spec, com a numeração original)

**E14: comentários de destaque (emenda v2.1)**
107. **Antes da migration**, a chamada de leitura de 4.6.1 foi feita pelo dono ou com a autorização dele, e as respostas estão guardadas como fixture e anotadas no ledger: a chave de API basta ou não; quantas respostas vêm em `replies` e em que ordem; `textOriginal` vem ou não; `comments.list?id=` com um id real e um inventado (quantos ids por chamada; o ausente derruba a chamada ou some da lista); o corpo exato do erro `commentsDisabled`. **Se a chave não bastar, a etapa para.**
108. (reescrito na v2.2) As perguntas 9 e 10 estão respondidas (decisões 25 e 26 do arquivo de decisões, 12/10) e os parâmetros de 4.6.2 e 4.6.3 em `rules.ts` são os aprovados; a pergunta 21 (o vínculo do canal acompanhado) tem resposta registrada **antes** de o primeiro comentário completar 28 dias em produção; a 14 tem resposta antes de a fila mostrar comentários.
109. Seleção reproduzível: a mesma resposta fixa da API, com a ordem dos itens embaralhada dentro do mesmo `likeCount`, dá a mesma lista de escolhidos (teste da função pura); bordas: empate em curtidas, lote de 5, lote de 100, nenhum com o criador, mais de 4 com o criador, comentário que é o mais curtido **e** tem resposta do criador (entra uma vez, com os dois sinalizadores).
110. `criador_respondeu`: `sim` com resposta do canal do vídeo entre as vistas; `não` só quando o número de respostas vistas é igual a `totalReplyCount`; nulo ("não se sabe") quando vieram menos e nenhuma é dele (teste com as três respostas fixas). Nenhuma tela escreve "não respondeu" para o nulo.
111. Estados: resposta fixa com erro `commentsDisabled` grava `desligados`; 200 com zero conversas e `commentCount` 0 grava `sem_comentarios`; **200 com zero conversas e `commentCount` 57 grava `erro`**, não `sem_comentarios`; falha de rede grava `erro` e tenta de novo dentro da tolerância; vídeo sem retrato lê como "não coletado" com motivo (teste do leitor com o banco **sem nenhuma linha** das três tabelas).
112. Tolerância: vídeo descoberto com 12 dias não ganha os retratos 1 e 7 e ganha o 30; retrato do marco 7 nunca é gravado com idade maior que 10 dias (teste com relógio falso).
113. **Identidade só nas três colunas e só de quem não é o criador:** as colunas de autor de `competitor_video_comments` são exatamente `author_display_name`, `author_channel_id`, `author_avatar_url`, `author_expires_at` e `author_purged_at` (consulta em `information_schema.columns`); `select count(*) from competitor_video_comments where is_creator and (author_display_name is not null or author_channel_id is not null or author_avatar_url is not null)` = 0; nenhum arquivo de foto de autor existe no Blob (nenhum caminho novo sob `observatorio/`).
114. A resposta bruta da API e o lote de 100 não são gravados em lugar nenhum: `competitor_raw` não ganha linha na coleta de comentários (contagem igual antes e depois), e nenhum log da execução contém o texto sentinela.
115. Só respostas do criador são gravadas: `select count(*) from competitor_video_comments where parent_id is not null and not is_creator` = 0; no máximo 3 por conversa.
116. Texto com mais de 2.000 caracteres é cortado e marcado; texto com emoji, quebra de linha, HTML e um `<script>` é gravado como texto puro e aparece na tela como texto (teste do componente em `// @vitest-environment jsdom`; nenhum endereço vira link).
117. RLS: papel sem `can_edit_site` não lê `competitor_video_comments` nem `competitor_video_comment_marks`, com o GUC `app.site_id` forjado por papel sem superusuário; lê `competitor_video_comment_snaps` só com `can_view_site`. Usuário só de leitura não recebe o texto no HTML nem no RSC, e a tela diz que há texto que ele não vê.
118. Comentário que deixa de vir: ausente do lote **e** da conferência por id ganha `missing_since` e aparece na fila agrupado por vídeo; presente só na conferência por id tem as curtidas atualizadas e `relevance_rank` nulo; marcar **não apaga nada**. "Apagar" na fila remove a linha e as leituras, deixa só o id em `competitor_removed_items`, e o texto some de toda tela no mesmo instante. (Se a pergunta 14 escolher apagar sozinho: o item passa a ser "o texto é apagado na mesma execução e resta só o id", com teste.)
119. Nenhuma resposta de endpoint do pipeline (Cowork e forja) nem pacote da forja contém o comentário sentinela (teste que varre as respostas).
120. Apagar um vídeo (4.5) ou remover um canal leva os comentários: `competitor_channel_removal_impact` conta as três tabelas, e depois da remoção `select count(*)` nas três para o canal = 0.
121. Cota e relógio: `youtube_quota_usage.operations` traz o total do modo `comentarios` por dia; a execução que bate no teto registra quantos retratos ficaram para trás e eles entram primeiro na seguinte (teste que conta as chamadas); o tempo do passo com 75 canais simulados está anotado.
122. **Uma semana depois do deploy**, o tamanho real das três tabelas e as unidades reais por canal e dia estão anotados e comparados com 9.5 (≈ 1,3 MB por canal por ano; 1,35 unidade por canal por dia); se a diferença passar de 30%, 9.5 é corrigida.
123. **NP-E14:** todo vídeo que fez 1, 7 ou 30 dias ontem tem o retrato do marco: `select count(*) from competitor_videos v where missing_since is null and discovered_at > '<deploy>' and published_at::date = :hoje - (1 + N) and not exists (select 1 from competitor_video_comment_snaps s where s.video_id = v.id and s.mark = N)` = 0 para N = 1, 7 e 30 (o vídeo descoberto depois da tolerância fica fora, com o motivo).
124. M11 e M12: testes de borda (menos de 5 vídeos; curtidas do vídeo ocultas; retrato `desligados`; exatamente 10 vídeos para o percentual), e o texto de M11 em tela diz "não vimos resposta", nunca "não respondeu".

125. **Não existe identidade de autor com mais de 28 dias** (a prova, rodada todo dia e em todo aceite): `select count(*) from competitor_video_comments where (author_display_name is not null or author_channel_id is not null or author_avatar_url is not null) and first_seen_at < now() - interval '29 days'` = 0. O dia a mais é o ciclo da rotina diária: a identidade vence aos 28 dias e é apagada, no máximo, 24 horas depois, sempre antes dos 30. E `select count(*) … where author_expires_at is distinct from first_seen_at + interval '28 days' and author_purged_at is null and not is_creator` = 0 (o prazo nunca foi renovado).
126. A rotina é idempotente e não regrava: rodada duas vezes seguidas, a segunda altera 0 linhas; um comentário com `author_purged_at` que volta no lote do marco 30 continua com as três colunas nulas (teste com relógio falso); depois de anular, `is_creator`, `creator_replied`, `featured_reason` e `featured_channel_id` são iguais aos de antes (teste que compara a linha antes e depois).
127. **A rotina falha em vermelho:** com a rotina desligada num teste (a chamada removida do cron), no segundo dia `cron_health` marca falha para `competitor-comment-identity`, o passo de comentários devolve `status: 'error'` e **não coleta**, e o cabeçalho mostra "identidade de autores vencida e não apagada: N"; teste que **apaga** a linha de `cron_health` e afirma que o estado é "sem leitura", nunca verde. O leitor de tela não devolve identidade vencida mesmo com a rotina parada. O export de um canal não contém nome, id nem URL de foto de autor (teste com sentinelas na semente).

**E14, autor de destaque (emenda v2.2)**
144. A regra (b), nas bordas (teste da função pura): autor com 99.999 inscritos não é destaque; com 100.000 e razão 9,9 não é; com 100.000 e razão 10 é; inscritos ocultos ou autor sem id de canal não é destaque e soma em `featured_unknown_n`, **nunca** lido como pequeno; inscritos do canal do vídeo ocultos: vale só o piso, `featured_ratio_band` nula, e a tela diz "razão não medida".
145. A consulta: uma chamada `channels.list` por vídeo e marco, com no máximo 20 autores, sem o criador e sem os canais acompanhados (teste que conta as chamadas e confere os ids pedidos); se a consulta falhar, o retrato **não falha**: `featured_lookup_n` fica nulo, nenhum comentário é marcado por (b), e a tela diz "tamanho dos autores não consultado", não "nenhum canal grande".
146. **O número de inscritos do autor e a razão exata não são gravados em lugar nenhum:** as tabelas de comentários não têm coluna numérica de inscritos (consulta em `information_schema.columns`); com um autor sentinela de 437.000.000 de inscritos na resposta fixa, o número não aparece nas três tabelas, em `rule_params`, em `competitor_raw` nem no log da execução.
147. **O que fica depois dos 28 dias:** rodada a rotina com relógio falso, `featured_reason`, `featured_size_band` e `featured_ratio_band` são iguais aos de antes, as três colunas de identidade são nulas, e a tela mostra "um canal com mais de 10 milhões de inscritos comentou" **sem** o nome nem a foto (teste do componente com o comentário sentinela; o nome sentinela não está no HTML nem no RSC).
148. A exceção do canal acompanhado: depois da rotina, `featured_channel_id` continua preenchido e a tela mostra o nome vindo do cadastro; as três colunas de identidade daquele comentário são nulas como as de qualquer outro. (Se a pergunta 21 for "não": `featured_channel_id` é anulado pela mesma rotina, e o teste afirma isso.)
149. Preferência nas duas vagas: canal acompanhado antes de canal grande; entre os grandes, faixa maior primeiro; a frase do topo diz "entre os 20 mais curtidos". **Uma semana depois do deploy**, as unidades reais da consulta por canal e dia estão anotadas e comparadas com 0,81; diferença acima de 30% corrige 9.5.
