# Fase de manutenção de dados (NAS e forja): spec, parte 03: o ciclo, as falhas e o ensaio

> Parte do spec de 13/10/2026. Índice e marcas de fato: [`00-indice.md`](00-indice.md). Regra do projeto que manda nesta parte: **este sistema falha em verde.** Por isso cada passo responde primeiro "o que acontece quando o dado não existe" e só depois "quando dá erro".

## 12. O ciclo de um mês

### 12.1 A linha do tempo de um mês

Exemplo com a série diária de outubro de 2026.

| Quando | O que acontece | Quem |
|---|---|---|
| 31/10 | O mês fecha (meia-noite de São Paulo) | relógio |
| até 28/11 | Margem de 28 dias: nada é exportado | site |
| 28/11 em diante | O plano passa a devolver as unidades do mês. O copiador exporta, grava no NAS, relê, conta, soma e informa. Com todas recebidas, o site gera o resumo (recalculando o hash de cada unidade), o copiador o recebe, depois recebe o manifesto, e **só então** o mês fica **selado** (ordem do selo: seção 10.4) | site e forja |
| duas vezes por dia | O copiador relê o mês (unidades, resumo e manifesto) e informa (atestação do NAS, validade de 24 h). A tarefa de cópia do NAS leva os arquivos ao B2, uma vez por dia | forja e NAS |
| uma vez por mês | O dono confere o B2 contra o manifesto (validade de 35 dias) | dono, no Mac |
| a cada 180 dias por tabela, ou quando uma coluna mudar | Ensaio de restauração a partir do B2 | dono, no Mac |
| 01/05/2027 | Novembro a abril estão fechados: outubro vira candidato. O botão acende se a cadeia estiver verde | relógio e site |
| o primeiro clique | A função recalcula tudo e **destaca** o mês: ele sai das telas, o espaço ainda não volta, e dá para trazer de volta enquanto o espaço não for liberado | dono |
| pelo menos 7 dias depois | O segundo clique **descarta**: a função confere tudo de novo e o espaço volta. Da quarta saída **da tabela** em diante os dois passos são um só (a regra é do banco: seção 10.5) | dono |
| depois da saída | O mês continua vigiado: o copiador relê os arquivos dele ao menos uma vez a cada 14 dias, e o comando mensal do dono confere um mês antigo no B2 (seção 10.6) | forja e dono |

Entre selar e sair passam cinco meses na série e dois na leitura horária. Um copiador parado por semanas ou uma casa desligada por um fim de semana não põe nada em risco, desde que o atraso apareça.

### 12.2 Passo a passo: quando o dado não existe e quando dá erro

**A última coluna é interna:** diz o estado que o site conhece, com as palavras do contrato. O texto que o dono lê na tela é só o da seção 14; nenhum mockup copia frase desta coluna.

| # | Passo | Quando o dado NÃO EXISTE | Quando DÁ ERRO | Estado que o site conhece (interno) |
|---|---|---|---|---|
| 0 | **Criar a partição dos meses seguintes** | Partição do mês não existe: o `insert` da coleta falha alto e a hora é registrada como **lacuna**. Não há `DEFAULT` que engula a linha. Mês com `detached_at` nunca é recriado | Tarefa falha ou a função sumiu: vermelho no vigia da agenda | meses de partição à frente; amarelo com menos de 6, vermelho com menos de 3. Sem leitura: vermelho |
| 1 | **Decidir o que é devido** (o plano) | Mês sem nenhuma linha em nenhum canal: registrado como **vazio conferido**, com contagem zero recontada pelo banco. Canal sem linha no mês: unidade vazia conferida, com o nome do canal. Mês anterior ao começo da série: não entra no registro | Rota desligada (variável ausente): responde "arquivo desligado", nunca lista vazia. Erro de banco: 500, nunca "nada devido" | aguardando a margem; vazio conferido; arquivo desligado; antes do início da coleta |
| 2 | **Exportar pela rota** | Tabela da política que não existe no banco: `tabela_ausente`, o mês não sela e fica vermelho. Unidade vazia: não gera arquivo, gera registro | Resposta maior que o teto de tamanho: a unidade fica `grande_demais` ou `falhou`, visível, **nunca truncada**. Unidade em partes cujas partes não trazem a mesma contagem, soma e hash da unidade inteira: descarta as partes e recomeça; depois de 3 vezes, `mudou_durante_a_leitura`. Contagem lida diferente da contada: recusa | copiando N de M; unidade parada com o motivo |
| 3 | **Baixar** (forja) | Site não responde, ou a forja está desligada: nada acontece em casa. O site mede o atraso sozinho | Bytes com sha256 diferente do cabeçalho: descarta e pede de novo | devida há mais de 5 dias: amarelo; mais de 30: vermelho; data do último batimento |
| 4 | **Gravar no NAS** | Pasta não montada, ou montada e **sem a sentinela `.arquivo-vivo` no filho em que vai gravar**: desfecho `nas_fora`, batimento com `nas_ok = falso`. **Nenhuma unidade é marcada como falha, nenhuma como copiada**, e nada é gravado no disco local no lugar | Disco cheio ou `refquota` do filho estourada: `nas_cheio`; o que ficou em `_recebendo` não vira arquivo. Alarme aos 80% da `refquota` do filho | NAS fora desde; NAS cheio |
| 5 | **Reler, contar e atestar o NAS** | Arquivo ausente na releitura (foi apagado, o dataset voltou de um snapshot antigo): a unidade perde a atestação e volta a **devida**, sempre como a versão seguinte (seção 10.6); o mês volta a "copiando". **Unidade de canal removido não volta a devida:** fica "aguardando arquivo do dono", o conserto é restaurar do B2 e, se o B2 também não tiver, a decisão digitada do dono a marca como perdida; até lá o mês não sai (seção 10.5). Parte ausente de uma unidade em partes é acusada pelo nome. Sem releitura em 24 h: a atestação vence sozinha. **O mês destacado continua sendo relido** duas vezes por dia até o descarte. **O mês descartado também continua:** em rodízio, ao menos uma vez a cada 14 dias; arquivo ausente ou diferente nele é vermelho, "cópia única em risco", desarma o interruptor, e o conserto é restaurar do B2; sem releitura há mais de 21 dias é amarelo, e há mais de 45, vermelho | Hash relido diferente do registrado: `divergente`. Hash igual e contagem ou soma diferentes das do registro: `conteudo_divergente`. Nos dois: alarme, interruptor desarmado, e o arquivo ruim **não é sobrescrito**: a correção é reexportar como a versão seguinte, mesmo com o conteúdo do banco igual (seção 10.6), ou, em mês que já saiu do banco e em unidade de canal removido, restaurar do B2 (seção 10.5) | sem atestação há N horas; divergente (mês, tabela, canal); cópia única em risco; mês no arquivo sem releitura há N dias; cópia de canal removido em risco; perdida em dd/mm |
| 6 | **Atestar o B2** (comando do dono) | Arquivo ausente no B2 (a tarefa não rodou, a pasta ficou fora da tarefa, o arquivo foi gravado por baixo da montagem): o comando lista os ausentes e **não grava** atestação. **A tentativa fica registrada** com o resultado (`b2_last_attempt_*`), e a tela a mostra. **E a atestação anterior é retirada na hora** (`b2_attested_at` anulado, seção 10.4): o verde não sobrevive a uma falha conhecida sobre o B2, e a saída recusa até uma execução que dê certo. Chave da cifra ausente na configuração do Mac (`chave_ausente`), ou sem acesso ao B2 (rede, credencial do Mac): o comando para, não grava atestação, a tentativa fica registrada e a atestação anterior **não** é retirada, porque a falha é do Mac e não da cópia; ela vence nos 35 dias normais. Nenhuma atestação em 35 dias: vencida | Conteúdo baixado com sha256 diferente do manifesto, **ou chave que existe e não decifra o arquivo**: `divergente`, com a lista, e a atestação anterior é retirada. A retirada desarma o interruptor | conferido em; sem conferência há N dias; última tentativa em, com o resultado; conferência retirada em, com o motivo |
| 7 | **Ensaiar a restauração** (comando do dono) | Nunca ensaiado para a **tabela**: a saída dela fica travada. Ensaio sobre mês vazio conferido, ou sem unidade com linha: **não vale**, e o comando diz isso. Ensaio com mais de 180 dias: vencido. Coluna da tabela mudou desde o ensaio: inválido | Diferença de contagem, de soma ou de conteúdo entre o restaurado, o manifesto e o registro online: ensaio **reprovado**, gravado como reprovado | ensaiado em, por tabela; vencido; inválido porque a tabela mudou |
| 8 | **Destacar o mês** (primeiro passo) | Partição ausente (alguém a soltou por fora): `particao_ausente`, vermelho, nada é marcado como saído. Mês não selado, canal com linha e sem unidade, marca pendente, dia não somado: recusa com o código (seção 10.5). Gatilho do invariante ausente ou desligado: `gatilho_ausente`, nada é destacado. Canal removido depois da selagem: a unidade dele fica no arquivo, vigiada, e o mês **não** volta a "não selado" | Trava não veio em 3 s, ou impasse com uma remoção em andamento: `ocupado`, nada mudou. Conteúdo mudou desde a selagem: recusa, mês volta a "não selado", reexporta. Banco em somente leitura: erro explícito e o passo de emergência | falta qual condição; destacado em, com a data a partir da qual dá para liberar o espaço (não há data limite para trazer de volta) |
| 9 | **Descartar o mês** (segundo passo, o irreversível) | Tabela destacada ausente com o mês ainda não descartado: `particao_ausente`, vermelho. Mês já descartado (segundo clique repetido): `ja_descartado`, nada muda, nada fica vermelho. Atestação do NAS vencida no dia, atestação do B2 vencida, ensaio vencido, arquivo divergente: **recusa, e a tabela destacada fica intacta**. Conferência do B2 retirada por tentativa que falhou: recusa. Gatilho do invariante ausente ou desligado: `gatilho_ausente`, e o espaço não é liberado. Antes da espera da classe desde o destaque (7 dias nas classes reais, 1 na de teste): `cedo_demais`. O segundo clique nunca veio: nada se perde; amarelo aos 14 dias | Contagem, soma ou hash da tabela destacada (recalculados por unidade, pela mesma junção da tabela anexada) diferentes do registro: recusa, e a saída é trazer de volta. Trava não veio: `ocupado` | pode liberar o espaço em; saiu em, liberou N% do banco |
| 10 | **Trazer de volta** | `dropped_at` preenchido: não há o que trazer (`descartado`); a tela não oferece o botão. **Não depende de arquivo nem de cópia verificada, e não apaga linha:** com mês destacado nenhum vídeo ou canal some (invariante da seção 10.5), então linha órfã não existe | Contagem, soma ou hash da tabela destacada diferentes do registro: **não recusa**; o mês volta e fica "não selado" (`mudou_no_destaque`), para ser copiado de novo. Recriar a chave falha (linha órfã, só com o gatilho burlado): desfaz tudo, `orfa_inesperada`, vermelho, conserto manual pelo runbook. Trava não veio: `ocupado` | de volta ao online em; de volta e será copiado de novo |
| 10b | **Apagar vídeo ou remover canal** (fila "Saíram do YouTube", botão "Remover canal", remoção com exportação da E10) | Nenhum mês destacado: apaga como hoje. Gatilho ausente ou desligado: o `detach` recusa antes (`gatilho_ausente`), então não nasce mês destacado sem o gatilho; derrubado depois do destaque, o vigia acusa em vermelho na linha do mês e o `discard` recusa (seção 10.5) | Há mês destacado: o banco recusa com `mes_destacado_em_transito`, nada é apagado nem pela metade, e a tela diz qual mês, a partir de quando dá para liberar o espaço e o que fazer (liberar o espaço ou trazer de volta). Impasse com um destaque em andamento: nada é apagado, e a tela diz "tente de novo" | remoção bloqueada por <mês> fora das telas |
| 11 | **Pedir período longo** | Forja sem batimento: o pedido expira em 15 minutos com `sem_trabalhador`. Pasta não montada ou sem sentinela no respondedor: `nas_fora`, **nunca `arquivo_ausente` nem resultado vazio**. Mês arquivado cujo arquivo não está lá: `arquivo_ausente`, e o mês entra na resposta como **incompleto**. Mês com zero linha no registro: "vazio conferido", com a data da conferência. Mês fora do registro: não é pedido | Arquivo que não abre, soma diferente do registro: `divergente`. Resultado maior que o teto: `grande_demais` | não respondeu; incompleto, faltam N de M meses; nunca "sem dados" |

**O que nunca é "ok" sem prova:** contagem zero sem registro de vazio conferido; lista vazia de rota desligada; conferência do B2 antiga depois de uma tentativa que acusou arquivo ausente ou diferente; mês que já saiu e cujos arquivos ninguém relê; copiador dizendo "nada devido" enquanto o site sabe de unidade devida; hash certo sem a contagem e a soma relidas; ensaio de restauração sem linha restaurada; resposta de relatório sem a cobertura por mês.

### 12.3 As atestações: quem, quando e por quanto tempo valem

| Atestação | Quem mede | Como | Validade |
|---|---|---|---|
| Conteúdo do banco | o banco, na hora de destacar e de novo na hora de descartar | recalcula `hash_conteudo`, contagem e soma | o instante |
| Cópia no NAS | a forja, **duas vezes por dia** enquanto o mês não foi descartado; depois, em rodízio, ao menos a cada 14 dias | relê os bytes, informa o sha256 e, abrindo o arquivo com o leitor de produção, a contagem e a soma; o site compara com o que ele próprio registrou. Cobre unidades, partes, resumo e manifesto | 24 h para a saída. Mês descartado: amarelo aos 21 dias sem releitura, vermelho aos 45 |
| Cópia no B2 | o dono, no Mac | baixa do B2 decifrando com a chave do cofre e compara com o manifesto (`rclone check --download`, ou equivalente que baixe de fato). Cobre unidades, resumo e manifesto. Toda tentativa fica registrada, mesmo a que falha | 35 dias, **ou até a primeira tentativa que acuse arquivo ausente ou arquivo diferente**, que a retira na hora. Chave ausente no Mac e falta de acesso não retiram |
| Restauração | o dono, no Mac | baixa um mês do B2, decifra, carrega num Postgres 17 descartável (`\copy` com a lista de colunas do manifesto), compara contagem, soma e conteúdo com o manifesto **e** com o registro online | 180 dias, **por tabela**, só com o mesmo `schema_fp` e só se restaurou unidade com linha |

**Limite que não se elimina.** "Li de volta do NAS" é a palavra da forja. Quatro coisas o contêm: o hash informado tem de ser igual ao que o site gravou na selagem (a forja não o inventa sem ter lido os bytes certos); a contagem e a soma vêm do arquivo aberto pelo leitor, não do cabeçalho; o B2 é conferido por outra máquina e por outra pessoa; e a restauração é feita a partir do B2. Forja parada por mais de 24 horas faz o clique recusar. É o comportamento certo, e a tela diz há quantas horas a cópia está sem verificação, para não parecer defeito.

### 12.4 O interruptor do automático

**A regra, escrita para não abrir a porta.** Nenhuma linha de série sai do online por prazo. O prazo escolhe qual mês é candidato; quem decide é a prova. As três primeiras saídas de cada tabela são pelos cliques do dono, em dois passos, e quem impõe isso é o banco (`dois_passos_obrigatorios`, seção 10.5). Depois, e só se o interruptor da classe estiver armado, uma tarefa diária do site chama **a mesma função**, no máximo um mês por dia (um mês é uma linha de `obs_archive_months`, tabela e mês, e o teto é por classe; uma saída por clique no mesmo dia faz a tarefa pular, sem desarmar). **A forja nunca solta nada.**

| Item | Regra |
|---|---|
| Classes que aceitam | Só `horaria` e `serie`. **`texto` nunca** |
| Para armar | Três saídas limpas **da própria classe**: descarte concluído de mês **com linha** (mês vazio conferido não conta, nem aqui nem nos 3 descartes da tabela: seção 10.5; as da classe `ensaio` não contam); a simulação da função (`p_dry_run`) vista pelo dono ao menos duas vezes, contadas pela tela (conta a resposta que o banco der, inclusive a que só lista o que falta); a variável `OBS_ARQUIVO_AUTO_DROP=on`; e o dono arma **por escrito**: digita a frase que a tela pede (seção 14.4) |
| Quando roda | A tarefa fica **devida a partir das 06:00 de São Paulo** (`aPartirDaHoraSP: 6`, 09:00 UTC) e roda no primeiro disparo da agenda depois disso; a agenda só dispara nos minutos 0, 20 e 40. São pelo menos 2 h 43 min depois da atestação das 06:17 UTC. Não existe "hora fixa com minuto" na agenda (seção 10.6). Com `ocupado` (a coleta estava gravando), tenta de novo nos disparos seguintes do mesmo dia, até o teto de tentativas da tarefa |
| Tabela com menos de 3 descartes | A tarefa **pula** essa tabela (`dois_passos_obrigatorios`) sem desarmar. O mês aparece na lista como "pronto para sair, em dois passos, pelo botão". É o caso da `early` quando a diária já tem as três saídas |
| Validade | 90 dias. Vence e desliga sozinho; o dono rearma conscientemente |
| O que desliga sozinho (lista fechada; é a mesma da tabela de motivos da seção 14.4) | (1) hash ou conteúdo diferente na reconferência, de mês online, destacado ou já descartado; (2) batimento do copiador ausente por 36 horas; (3) a **segunda** recusa seguida por `nas_sem_atestacao`; (4) atraso de cópia em vermelho (mais de 30 dias); (5) o sinal de limite em vermelho; (6) o sinal de limite sem medida hoje; (7) mais de um mês solto em 24 horas; (8) a validade vencida; (9) a variável ausente; (10) a conferência do B2 retirada por tentativa que falhou; (11) qualquer outra recusa da função |
| Recusas que **não** desligam | `ainda_na_janela`; `ocupado`; `dois_passos_obrigatorios`; `ja_destacado` (o mês espera o segundo passo do dono: a tarefa o pula e segue para o candidato seguinte da tabela); e a **primeira** `nas_sem_atestacao` |
| A atestação do NAS vencida | Não solta, e **não desarma na primeira vez**: uma execução perdida do copiador não pode derrubar o automático. Desarma na **segunda recusa seguida** pelo mesmo motivo (o contador fica em `obs_archive_switch`) |
| O que religa sozinho | **Nada.** Só o dono |
| Depois de desligar, o que acontece com os contadores | As saídas completas já feitas **continuam contando**: o interruptor não volta a "indisponível". As duas simulações já vistas também continuam contando, mas ligar de novo exige **uma simulação vista depois do desligamento** e a frase digitada outra vez. Ligar de novo começa outros 90 dias |
| O que não muda com ele | As condições 1 a 10, 12 e 13 da seção 10.5 continuam valendo (a 12 é a trava; a 11 troca "quem administra" por "interruptor armado e válido"). A conferência mensal do B2 e o ensaio de restauração continuam sendo do dono: **mesmo no automático, sem a conferência do B2 com menos de 35 dias nada sai** |
| Como o dono fica sabendo que desligou | O aviso sai da página do arquivo: a pastilha do banco, presente em todas as telas do Observatório, leva a marca "automático desligou em dd/mm" até ele abrir a peça do automático (seção 14.4) |

O sinal em vermelho desliga o automático de propósito: o automático não é remédio para banco cheio. Com o banco perto do limite, quem decide é o dono, olhando a lista do que pode sair.

### 12.5 O sinal de limite depois que os meses começam a sair

A E10 projeta o limite pela reta dos últimos 28 dias (F19). Com a janela rolante o tamanho vira um serrote: cai a cada saída e sobe até a próxima. A reta mentiria "folga" logo depois de cada saída e "vermelho" logo antes. O sinal desta fase:

1. **Mede a subida sem o serrote:** soma de volta ao tamanho de cada dia os bytes liberados pelas saídas dentro da janela de medida (`bytes_freed`, gravado em cada descarte). A inclinação dessa série é o crescimento bruto por dia.
2. **Projeta o maior tamanho do ciclo:** tamanho de hoje mais o crescimento bruto até a próxima saída possível. É esse valor que decide a cor, não o tamanho logo depois de uma saída. Na tela ele se chama "o mais que o banco chega a ocupar antes da próxima saída" (seção 14.5).
3. **Mostra dois prazos separados:** "dias até o banco chegar a 85%" e "dias até a cadeia do próximo mês ficar verde". Se o primeiro for menor que o segundo, é vermelho, porque o alívio não chega a tempo.
4. **Soma as partições.** O registro de tamanho da E10 precisa somar tabelas comuns e particionadas e enxergar o schema `obs_part`; sem isso leria quase zero justamente nas tabelas que mais crescem (pedido 3 da seção 17). A tabela destacada (`_saida`) também é somada: enquanto não for descartada, o espaço dela não voltou.

**O pedido do dono de 13/10, e a troca que este texto faz.** Ele pediu, no retorno do mockup 18: "mandar para o backup no NAS ao chegar a um percentual, por botão ou por cron". O desenho faz diferente, e ele aceitou em 13/10 (decisão 9 da direção: o aviso de percentual "só avisa e sugere"): **copiar é automático e não espera percentual nenhum** (todo mês fechado é copiado no calendário); **sair** é o que o percentual sugere. Com 70% ou mais, o aviso lista os meses com a cadeia verde que já podem sair e quanto cada um libera, com o botão. Nada sai por causa do percentual. A troca está dita ao dono no resumo (seção 1, item 6), e muda a regra de cor do mockup 18 já aprovado (seção 14.5).

## 13. Restauração e ensaio

### 13.1 Por que ensaiar antes de janeiro

Um arquivo que nunca foi restaurado não é backup. E o dono estará fora a partir de janeiro de 2027 (D11): tudo o que depende da mão dele em casa tem de ter sido exercitado antes. O primeiro mês real só pode sair em 01/02/2027, então o ensaio não pode esperar por ele.

### 13.2 Parte A: banco local, com volume

No banco local de integração (`bythiago_int`), com tabelas normais (não temporárias, para haver WAL) e volume sintético de **75 canais por 7 meses**:

1. A conversão para tabela particionada, com um processo gravando a cada segundo durante a troca.
2. A cadeia inteira até o descarte, com um diretório local no lugar do NAS: exportar, conferir, recalcular hashes, destacar, trazer de volta, destacar, descartar, medir o tamanho antes e depois.
3. Cada recusa da seção 10.5, uma a uma (linha inserida depois da selagem; atestação com 25 horas; ensaio com 181 dias; coluna nova; dia sem soma; trava ocupada; descarte antes da espera da classe; descarte com atestação vencida; conferência do B2 retirada por tentativa que falhou; a composta na primeira saída da tabela, `dois_passos_obrigatorios`, na quarta, sem espera, e num mês já destacado, `ja_destacado`; com o mês destacado, apagar vídeo, remover canal e a cascata de canal para vídeo recusam (`mes_destacado_em_transito`), e fora do destaque apagam; "trazer de volta" com a tabela destacada alterada por fora volta e dessela; canal removido entre a selagem e o destaque não dessela o mês; o segundo descarte seguido, `ja_descartado`).
4. Ida e volta do formato: exportar, conferir, soltar, recarregar com `\copy`, reexportar, **sha256 do CSV sem compressão igual**.
5. O tempo do recálculo e do clique, e o teto de linhas por chamada (conferência CP13). Uma unidade de 2.500 linhas exportada inteira com `max_rows` 1.000.
6. O carregador das telas com a série começando 7 meses depois da publicação, e com um mês destacado e ainda não descartado (seção 14.1).
7. A onda 2: apagar um mês de comentários com resposta do criador vista no mês seguinte (a conversa sai inteira); a cascata alcançando linha fora da unidade (a recusa `resposta_fora_da_unidade` dispara, medida pela contagem antes e depois, e a transação é desfeita); linha em `authors` (`identidade_nao_anulada`); e o espaço reaproveitado medido.

### 13.3 Parte B: produção, sobre uma tabela de ensaio

**O meio honesto de exercitar produção sem esperar fevereiro e sem tocar dado real.** Uma tabela própria, `public.obs_archive_rehearsal`, com as mesmas colunas da leitura horária, particionada do mesmo jeito, registrada na política com a classe `ensaio`. Três regras a separam do dado real:

- **Não tem chave estrangeira** para vídeo, canal ou site (a regra da seção 10.1 vale para ela): com cascata ela entraria em `obs_archive_uncovered()` e quebraria o export da E10. O canal de cada linha vem de junção por `video_id`.
- **Só aparece na página do arquivo, num grupo próprio, "Dado de teste", só para quem administra o site** (seção 14.2). Nenhuma outra tela lê essa tabela.
- **Um pedido de relatório real nunca lê a classe `ensaio`;** o pedido do ensaio é um tipo próprio.

Uma função de carga (`obs_archive_rehearsal_seed(p_month date)`) grava nela linhas sintéticas, marcadas como tais, de **um mês antigo** (março de 2026 neste ensaio; o mês é argumento, para um ensaio futuro usar outro), para um punhado de canais reais, incluindo um canal sem linha (para exercitar "vazio conferido").

Como o mês é antigo de verdade, **as condições do portão valem como valerão em fevereiro**: a janela, as 24 horas, os 35 dias, a restauração e a trava. **A única diferença é a espera entre destacar e descartar, que é constante da política por classe:** 1 dia na `ensaio`, 7 nas classes reais. O ensaio percorre, em produção, na ordem:

| # | Passo do ensaio | O que exercita de verdade |
|---|---|---|
| 1 | Selar o mês de ensaio pela rota | A função na Vercel, o cliente de serviço, os tetos de tempo e de tamanho, a ordem do selo |
| 2 | O copiador baixa e grava no NAS | A chave, a forja, a montagem do filho, a sentinela, a permissão de escrita, a `refquota` |
| 3 | A reconferência roda pelo menos dois dias seguidos | As duas execuções diárias do copiador, o batimento, a medida de atraso pelo site |
| 4 | A tarefa de cópia leva ao B2 | Que a pasta do arquivo entra na tarefa, em modo `COPY`, cifrada, e que o arquivo está dentro do filho (não por baixo da montagem) |
| 5 | O dono confere o B2 no Mac, com a chave **tirada do cofre** | A cópia da chave, a chave de leitura do B2, o comando |
| 6 | O dono restaura o mês do B2 num Postgres descartável e compara | A restauração inteira, do zero |
| 7 | A simulação da saída (`p_dry_run`), duas vezes | As conferências, sem mudar nada |
| 8 | O clique: **destacar; trazer de volta; destacar de novo; e descartar no dia seguinte** | As três funções em produção, a trava, a queda do tamanho medido, e o "trazer de volta" |
| 9 | Pedir um relatório que cubra o mês de ensaio | A fila, o respondedor, o resultado, a cobertura |
| 10 | **Ensaio de casa fora do ar**, de propósito: desmontar a pasta, parar o copiador, parar o respondedor, um de cada vez | Que cada um vira o estado certo na página do arquivo, e nunca "ok" |
| 11 | **Reiniciar a forja uma vez** | Que as quatro montagens voltam sozinhas e o copiador roda no horário seguinte. Ela reinicia toda semana e não haverá ninguém em casa |
| 12 | **Ensaio de chave ausente:** rodar a conferência do B2 sem a chave, e depois de novo com ela | Que o comando para, não grava atestação, deixa a tentativa registrada e **não retira a conferência anterior**, e que a tela diz que falta a chave; e que a execução seguinte, com a chave, grava a conferência nova |
| 13 | **A conferência do B2 e o ensaio de restauração rodados uma vez com o Mac fora da rede de casa** (pelo celular) | Que os dois comandos mensais do dono funcionam de longe, antes da viagem |

**Os passos 1 a 6 começam em 26/11/2026**, assim que o copiador estiver instalado, sem esperar a etapa M7 (período longo). Só o passo 9 depende dela.

**Quem encerra o dado de teste.** Depois dos treze passos, quem administra o site clica em "Encerrar o dado de teste" na página do arquivo (seção 14.2). O botão só aparece com a recuperação testada e o descarte de teste feitos; ele grava `closed_at` e `closed_by` no registro dos meses da classe `ensaio` (seção 10.4), e o grupo some da página. Os arquivos de teste ficam no NAS e no B2; a tabela de ensaio fica vazia e sai numa migration posterior.

### 13.4 Parte C: o mês real de outubro, até onde dá

A série diária de outubro de 2026 fica devida em 28/11/2026. Ela percorre a cadeia real, em produção, até **"restauração ensaiada"**: selar, copiar, atestar NAS, atestar B2, restaurar do B2 e comparar com o banco, que ainda tem o mês. **Ela não sai.** É a primeira restauração com dado de verdade, e é ela que vale como ensaio da tabela diária para o clique de maio (se for refeita dentro de 180 dias antes dele: seção 15.2).

**A classe `serie` precisa de dois ensaios: o da diária e o da `early`.** A `early` está vazia hoje (F5). Se ela não tiver linha em outubro, o ensaio dela é feito no primeiro mês selado com linha, e a saída da `early` fica travada até lá (condição 7, por tabela). O ensaio da diária não libera a `early`.

### 13.5 O que este ensaio NÃO prova

| # | O que fica sem prova | Por que | O que cobre o risco |
|---|---|---|---|
| 1 | Soltar a partição de uma tabela real **com a coleta gravando nela a cada hora** | A tabela de ensaio não tem coletor | O teste local com gravação concorrente; a função desiste em 3 s sem mudar nada; o primeiro clique real é em dois passos, e dá para desfazer até o descarte, que só é aceito 7 dias depois |
| 2 | Tamanho e tempo reais de um mês de leitura horária | A tabela está vazia em produção hoje | A parte A mede com 75 canais; unidade grande demais é recusada, nunca truncada |
| 3 | As telas depois de uma saída real | Nenhum mês real saiu | Teste do carregador com série cortada e com mês destacado (seção 14.1); o primeiro clique das séries é em maio, depois de três saídas da leitura horária |
| 4 | A condição "todo dia somado" sobre dado real | `competitor_hour_fold_log` está vazio | Teste local; simulação em produção assim que houver um mês de leitura horária fechado |
| 5 | Dado que muda entre selar e sair (2 a 5 meses) | O ensaio dura dias | O portão recalcula o hash: mudança vira reexportação, nunca apagamento |
| 6 | Tudo o que vence com o tempo: a atestação do B2 aos 35 dias, o ensaio aos 180, o interruptor aos 90 | O ensaio não dura tanto | Testes com relógio falso; a tela avisa antes de vencer |
| 7 | Casa fora do ar **por semanas**, com o dono longe | O ensaio de casa fora dura minutos | Nada sai (seguro); o banco cresce; a folga em números está na seção 13.6 (18 meses com 15 canais, 12 com 25, 8 com 50); risco aberto na seção 19.2 |
| 8 | Onda 2 (texto, por apagamento) em produção | Não há comentário coletado ainda | A parte A, passo 7; e a onda 2 só entra depois de três saídas limpas das séries |
| 9 | Atualização do TrueNAS (25.10 para 27) e do sistema da forja | Não acontece no ensaio | Ensaio de restauração refeito depois de qualquer atualização grande; registrado no runbook |
| 10 | **O automático nunca rodou em produção** | Só é exercitado em teste, com relógio falso. Ele fica disponível em abril de 2027, e o primeiro mês que pode tirar sozinho é elegível em 01/05/2027, com o dono longe | Desligado de fábrica; desliga sozinho ao primeiro problema; chama a mesma função dos cliques |
| 11 | **O passo de emergência do banco em modo somente leitura** | Não é ensaiável sem estourar o limite de propósito | Os comandos são os documentados pelo Supabase; o sinal avisa meses antes |
| 12 | **O ensaio de restauração da `early`** | A tabela está vazia; ensaio sem linha não vale | A saída da `early` fica travada até o primeiro mês selado com linha ser restaurado (seção 13.4) |
| 13 | **"Trazer de volta" numa tabela real, com a coleta gravando** | Na parte B o trazer de volta roda sobre a tabela de ensaio, sem coletor | Teste local com gravação concorrente; a função confere contagem e soma ao recolocar |

### 13.6 Volta atrás, por etapa, e o que acontece com a casa desligada

| Etapa | Como voltar | Até quando |
|---|---|---|
| Podas | Não voltam: são apagamento de estado de execução | n/a |
| Recuperar `cron.job_run_details` | Não há o que voltar: a reescrita só devolve espaço | n/a |
| Partições | Renomear a tabela antiga de volta, recriar as chaves estrangeiras dela e copiar o que entrou no intervalo | 7 dias, enquanto a antiga existir |
| Rotas e copiador | `OBS_ARQUIVO` ausente desliga as rotas; tirar a linha do cron do copiador (do dono) | sempre |
| Mês destacado e ainda não descartado | "Trazer de volta" (`obs_archive_reattach_month`) | enquanto o descarte não for feito; a tela avisa aos 14 dias |
| Saída depois do descarte | Restaurar do arquivo: `\copy` dos arquivos do mês numa partição nova. É comando do dono, não botão | sempre que as duas cópias existirem |
| Saída de texto | Restaurar do arquivo, consultando antes `competitor_removed_items` para não ressuscitar o que foi apagado | idem |
| Interruptor | Desarmar na tela, ou apagar a variável | sempre |

**Casa desligada com o dono longe: o que acontece, em números.** Não existe caminho de saída sem a casa (seção 10.5). O que acontece é isto:

1. **Nada sai do online.** O portão exige a cópia do NAS atestada há no máximo 24 horas (condição 5 da seção 10.5). Sem a casa a atestação vence em um dia e as quatro funções recusam; o automático desarma com 36 horas sem batimento. Nenhum dado é apagado por causa da casa fora.
2. **O que já foi copiado continua copiado, e a cópia que faltar só atrasa.** Entre a cópia de um mês e a saída dele há meses de calendário: cerca de cinco nas séries (outubro é copiado a partir de 28/11 e só pode sair em 01/05), quatro e meio no texto e dois na leitura de hora em hora; na média, cerca de quatro. Uma casa fora por algumas semanas não atrasa saída nenhuma, desde que volte antes do dia da saída: o mês que fechou nesse intervalo é copiado na volta, porque quem diz o que é devido é o site.
3. **O banco continua crescendo no ritmo medido.** A coleta não depende da casa.
4. **O sinal de limite avisa.** Âmbar aos 70%, vermelho aos 85%, sempre com a data desde a qual a casa não responde (seção 14.5). O aviso não depende da casa.
5. **A folga, em números** (ESTIMATIVA, pela fórmula da seção 8.1, sem nenhum mês saindo). É o pior caso: a casa cai no dia da viagem, em janeiro de 2027, e não volta. Como a primeira saída real só acontece em 01/02/2027, é o mesmo que "nada sai nunca" (tabela da seção 8.4). Se a casa cair mais tarde, a folga é maior, porque os meses anteriores já terão saído.

| Canais (chegando a esse número em 12 meses) | Aviso âmbar (70%) | **Sinal vermelho (85%)** | **Meses de casa desligada até o vermelho, contados de janeiro de 2027** | Banco em modo somente leitura (100%) |
|---|---|---|---|---|
| 15 (hoje) | fevereiro de 2028 | julho de 2028 | **18** | novembro de 2028 (22 meses) |
| 25 | novembro de 2027 | janeiro de 2028 | **12** | abril de 2028 (15 meses) |
| 50 | agosto de 2027 | setembro de 2027 | **8** | novembro de 2027 (10 meses) |

   A conta supõe que os canais continuam entrando mesmo com a casa fora. Parando de acrescentar canal no dia em que a casa cai, a folga cresce. Com o padrão da pergunta 10 (o dono fica fora 6 meses), os três casos cabem: mesmo com 50 canais o vermelho vem 8 meses depois de janeiro. **Faixa de erro** (ESTIMATIVA, mesma fórmula; meses até o vermelho com 15, 25 e 50 canais): com o custo por canal 30% acima, **13, 10 e 7**; sem a recuperação dos 49 MB, 15, 11 e 7; os dois juntos, 11, 8 e 6. Com 50 canais o pior caso toca os 6 meses da pergunta 10.
6. **O que se faz, e é pouco.** Religar a casa (pergunta 4: quem pode); **não acrescentar canal** enquanto ela estiver fora; e, se o vermelho chegar antes de ela voltar, pausar a coleta de canais (a pausa não depende da casa), que freia o crescimento. **A pausa é o comando `pausar` da E10,** rodado pelo dono no Mac, e ainda não existe (F19): se a E10 não estiver em produção, esta alavanca não existe e a folga é só a da tabela. Remover canal com export pede a confirmação do NAS e não está disponível.
7. **O único ponto em que dado se perde.** Se o banco chegar a 100% entra em modo somente leitura, a coleta para, e a leitura de hora em hora que não foi coletada não volta. Pela tabela, isso leva de 10 a 22 meses de casa desligada.
8. **O que não existe:** saída sem as duas cópias conferidas, saída sem restauração ensaiada, alavanca automática, e modo de emergência sem a casa. Este último foi considerado e retirado; o motivo e o gatilho que o reabriria estão na seção 19.3, J13.
