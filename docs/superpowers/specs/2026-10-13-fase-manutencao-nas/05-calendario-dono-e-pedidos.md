# Fase de manutenção de dados (NAS e forja): spec, parte 05: calendário, o que é do dono rodar e pedidos à A5

> Parte do spec de 13/10/2026. Índice e marcas de fato: [`00-indice.md`](00-indice.md).
>
> **Emenda de 14/10/2026 nesta parte:** a etapa M10 (saída por idade do vídeo), em três fatias, e a mudança de casa no calendário (seção 15.1); o relógio do dado com a conferência diária do B2 e a primeira retirada de vídeos antigos (seção 15.2); os passos novos do dono (seções 16.4, 16.5, 16.7 e 16.8) e as seções novas 16.11 (roteiro da mudança) e 16.12 (uma vez, antes de partir); e os pedidos 15 a 17 à A5. **No conserto da rodada 1:** o que escorrega se a M8 usar a reserva, as sessões de ensaio contadas a partir de fevereiro de 2027, a primeira retirada um canal por vez, o cofre como condição da M3a e o pedido 17 decidido. **Pelo item 12:** as fatias 12a (na M3b, não se corta) e 12b (na M9), o passo do ensaio, o comando `expurgar --canal` (seção 16.10) e o pedido 18. **No conserto da rodada 2:** o bloco "Canais removidos" só de leitura entra com a página do Arquivo (M5) e a frase do diálogo antes de 28/11 (seção 15.1); `expurgar --canal` não imprime nada com mudança de casa aberta (seção 16.10); e as linhas 10 e 11 da lista de antes de partir (seção 16.12).

## 15. Calendário

Duas colunas que não se misturam. **Entrega** é construir, promover, instalar e ensaiar: tudo em 2026, o mais cedo possível, na ordem de dependência (D11). **Relógio do dado** é o que só acontece quando a linha tem idade: não se adianta, e depois de janeiro é feito pelo dono no site, de longe.

### 15.1 Entrega

As datas são metas, na ordem de dependência, **refeitas em 14/10/2026 com a emenda** (a etapa M10, a conferência do B2 pela forja e a mudança de casa). O limite duro é um só: **tudo o que exige o dono em casa pronto até 15/12/2026, com reserva até 22/12** (pergunta 12 da seção 20, que absorveu a 3). A mão do dono aparece em duas colunas, porque são coisas diferentes: **"em casa"** é o que exige estar em casa ou com a casa ligada (NAS, forja); **"do Mac"** é o que ele faz de qualquer lugar (`db:push:prod`, cliques no site e na Vercel, B2, ensaio de restauração).

| Etapa | O que entrega | Meta | Depende de | Dono, em casa | Dono, do Mac | O que destrava |
|---|---|---|---|---|---|---|
| **M0. Medidas que faltam** | As conferências da seção 7 e as respostas da seção 20. **Emenda de 14/10:** mais as conferências CP21 a CP23, CP27 e CP28 (as medidas M1 a M10 da saída por idade já rodaram em 13/10: seção 6.8) e três respostas que travam etapa: a data da mudança (pergunta 12), o horário da cópia para o B2 (pergunta 17) e como o dataset cifrado destrava (pergunta 14) | 20/10/2026 | nada | CP8, CP21, CP22 e CP27 (shell e tela do NAS) | Seis consultas de leitura, mais as três da CP28; o painel do B2 (regra de versões); o painel da rede privada (CP23) | M1, M3a e a M10 |
| **M1. Podas e espaço** | Poda de `cron_runs` e de `yt_own_collection_attempts` (90 dias); recuperação de `cron.job_run_details` | 31/10/2026 | CP2 e CP3 | Não | `db:push:prod`; o comando que reescreve a tabela | 49 MB de uma vez e cerca de 36 MB por ano; não depende do NAS |
| **M2. Partições** | As três séries particionadas por mês; `obs_part`; `obs_partitions_ensure` com chamador; o invariante "meses à frente" lido pelo vigia da agenda; a tabela de ensaio; o teste que lê as migrations (seção 10.2) | 07/11/2026 (limite: 30/11) | Pedidos 1, 3, 5 e 6 da seção 17 | Não | `db:push:prod`, na janela | **É imediata:** `early` e `hourly` estão vazias e `daily` tem 1 MB (F5). Cada semana de leitura horária gravando encarece a troca |
| **M10a. Vídeo antigo, o que não depende de ninguém** (emenda de 14/10) | As colunas do toco; `obs_archive_video_policy` com H = 24 e a classe **fechada**; a guarda de `insert` nas 8 tabelas; o teste dos leitores de `competitor_videos`; os oito pontos em que a coleta e os carregadores respeitam a marca; e a prova "com zero vídeo marcado, o conjunto de dados é idêntico". **A classe na chave do registro e no caminho do arquivo entra na M3b** | 07/11/2026, junto da M2; a chave, em 21/11, dentro da M3b | Pedido 15 da seção 17 (janela combinada); CP29 (custo do gatilho, medido antes) | Não | `db:push:prod`, na janela. No mesmo dia da M2 são dois `db:push:prod` separados: a M2 primeiro e conferida, depois as colunas e os gatilhos | Quanto antes entrar, mais cedo existe a prova de dados idênticos. **Não se corta** |
| **M3a. Casa** | Exclusão na tarefa antiga; bucket; dataset e os dois filhos, com `refquota`, dono e permissão; uma exportação NFS por filho; tarefa de cópia `COPY` cifrada; chave no cofre; quatro montagens; duas sentinelas; a prova de escrita (CP16); duas chaves de API. **Emenda de 14/10, para a conferência do B2 pela forja:** `rclone` instalado na forja (F77); chave do B2 só de leitura, da forja; a cifra configurada na forja **a partir do cofre**; a terceira chave de API (`archive_b2`); e duas verificações novas no serviço de fora da casa, com os blocos no `pulso.sh` | 15/11/2026 | Pergunta 1 (regra de versões do bucket); CP25 (versão do `rclone`); CP31 (onde mora o cofre) | **Sim, toda ela** | As três chaves de API; as duas chaves do B2 (painel) | M3b |
| **M3b. Arquivo durável** | Registro (`obs_archive_units`, `obs_archive_months` e as demais), **com a classe na chave de todas e no caminho do arquivo, e com a origem em toda atestação do B2** (emenda de 14/10: custa zero agora, e uma migration com mês selado depois); política; rotas; a serialização única e o leitor único; `hash_conteudo` e `schema_fp`; o copiador; **o `conferir-b2`, com o canário e o controle negativo;** a medida de atraso; o resumo mensal, **por canal**; `OBS_ARQUIVO=on`. **Emenda de 14/10 (item 12), fatia 12a, que não se corta:** a árvore `<classe>/canais/<canal>/` e `obs_archive_summaries` (são da própria M3b: depois de 28/11 não se mudam); `obs_archive_channel_removals`; as colunas `purged_*`; `competitor_channel_remove`, o gatilho `before delete` e a troca no botão; `obs_archive_is_site_admin`, **criada aqui por esta fase se a E10 ainda não a tiver criado** (a função da remoção a chama: seção 10.5, pedido 13); a trava em `unit/export` e na gravação do resumo; selagem, plano e portão ignorando o que tem `purged_at`; a lista derivada, as consultas de vigia e a função que a restauração consulta; a frase do diálogo, **em produção antes da primeira selagem (28/11):** até lá nenhum canal tem unidade, e o diálogo de hoje não mente; e, **quando a página do Arquivo nascer (M5), o bloco "Canais removidos" só de leitura** (a lista derivada com "limpeza pedida", "sem aviso de remoção", "guardado" e o grupo "Já limpos (N)", que traz os sem arquivo **sem imagem por apagar no Blob** (o que ainda tem imagem fica à vista com a linha do Blob); sem ação e sem comando): é ele que deixa a remoção visível se a M9 for cortada. Tudo na mesma migration em que `obs_archive_units` nasce: não existe dia com unidade e sem a regra | Código em produção até 21/11; copiador e `conferir-b2` instalados até 25/11 | M2; as tarefas 5 e 6 da E10 (formato e `exportarUnidade`: pedido 2), **ou o gatilho de 07/11/2026 abaixo**; CP21 (a hora do `conferir-b2`) | Instalar o copiador e o `conferir-b2` | `db:push:prod`; a variável na Vercel | A primeira selagem real, em 28/11, **que o `conferir-b2` já confere no B2** |
| **M4. Mockups** | As **nove** peças da seção 14 (eram sete; a 8 e a 9 são da emenda de 14/10); o mockup 19 (nasce do zero, e ganha os quadros do vídeo antigo); o `18-v2`; a tabela de sincronia (seção 14.9) | Começa já, em paralelo; aprovados até 27/11/2026 (era 20/11: a emenda acrescenta cerca de uma semana) | nada | Não | Aprovar cada um | M5 e a M10b |
| **M5. Telas** | O carregador pela janela real (`online desde`); "no arquivo"; os outros leitores das séries (seção 14.1); a página do arquivo, **com o bloco "Canais removidos" só de leitura (seção 14.2) e a marca "N canais removidos pedem um comando seu" ao lado da pastilha (seção 14.5)**; o aviso de limite ajustado | 05/12/2026 | M3b, M4; pedido 11 | Não | Não | A classe `serie` fica liberada para sair (condição 1 da seção 10.5) |
| **M6. Saída** | `obs_archive_detach_month`, `discard`, `reattach` e `drop`; a regra dos dois passos no banco, por tabela; os gatilhos do invariante do mês destacado, e a frase da recusa no botão "Remover canal" (seção 10.5, pedido 14); a simulação; o botão; o interruptor (desligado) e a tarefa da agenda; o rodízio de reconferência dos meses descartados; o sinal sem serrote; e `obs_archive_is_site_admin`, que existe desde a M3b (seção 10.5, pedido 13) | 05/12/2026 | M3b, M4 | Não | `db:push:prod` | O clique |
| **M10b. Vídeo antigo, congelar** (emenda de 14/10) | A função de congelar, com a simulação; a tarefa da agenda, com `OBS_ARQUIVO_IDADE_VIDEO` desligada; a leitura mensal dos tocos; a prova da série ajustada; as telas da peça 8 e a seção "Vídeos antigos"; e a classe liberada no mesmo release das telas | 05/12/2026 (reserva: 12/12) | M10a, M3b, M4, M5 | Não | `db:push:prod`; aprovar os quadros | O primeiro congelamento real, em dezembro |
| **M7. Período longo** | Fila, respondedor, resultado, a peça 6. **Item 12:** o `request/claim` com a lista dos arquivos de resumo, e **a medida do respondedor com um resumo por canal** (até 16.200 arquivos de resumo em 5 anos com 75 canais; 2.700 só da classe usada pelas medidas: ESTIMATIVA, a medir aqui; seção 10.6) | Instalado até 12/12/2026 | M3b | Instalar o serviço | Não | O relatório. Já há o que ler desde 28/11: os meses selados existem no arquivo mesmo antes de saírem do online |
| **M8. Ensaio completo** | As partes A, B e C da seção 13, com a restauração a partir do B2, os ensaios de casa fora, o reinício da forja, a chave ausente e os comandos do dono rodados fora da rede de casa. **Emenda de 14/10, passos 14 a 18:** a conferência do B2 pela forja com o controle negativo e o canário provocados; o aviso chegando ao celular do dono fora da rede de casa; o reinício do NAS; `ensaiar-restauracao --todas`, com a duração medida; e o primeiro congelamento real, por simulação e clique. **Item 12, passo 19:** remover um canal de teste e limpar o arquivo dele, de fora da rede de casa | Passos 1 a 6 da parte B a partir de 26/11; tudo até 15/12/2026 (reserva: 22/12) | M3 a M7 e a M10b (só o passo 9 depende da M7; só o 18, da M10b; só o 19, da M9: cortada a M9, o passo 19 sai do ensaio) | **Sim** | O ensaio de restauração; os cliques | A mudança de casa e a viagem |
| **M9. Expurgo enxuto** | `archive_pending`, a lista de arquivos do item, "Ver os comandos", "Já rodei", o comando `expurgar`, o amarelo aos 30 dias. **Emenda de 14/10 (item 12), fatia 12b:** `expurgar --canal`; a conferência de ausência no copiador e a listagem de versões no `conferir-b2`; os marcos e o reaparecimento; a ação "apagar do arquivo", "ver os comandos" e, no bloco "Canais removidos" (que existe só de leitura desde a M5), os estados com prova de fim; o apagamento do Blob (ou a E9, o que vier primeiro) e do lote da E10, com a nova tentativa diária do que falhou (`blobs_pending`), numa tarefa da agenda | 12/12/2026 | M3b, M5; a E9 em produção | Não | Não | Fecha a lacuna da E9 |
| **M10c. Vídeo antigo, retirar** (emenda de 14/10) | A função da retirada; os anexos de miniatura; os ensaios de restauração por (classe, tabela); o "apagar" de vídeo do arquivo no expurgo | Código em produção até 12/12/2026, se couber | M10b, M6 (portão), M9 | Não | `db:push:prod`; do Mac, os ensaios e o clique | **A primeira retirada real, em fevereiro de 2027, por clique, de longe** (o mês de dezembro sela em 28/01). É o primeiro uso real do apagamento por faixa (seção 13.5, linha 14) |
| **A mudança de casa** (emenda de 14/10; seção 10.10) | As máquinas na casa do irmão, com o estado aberto e fechado pela página do arquivo, e o roteiro da seção 16.11 | **Entre a M8 e a partida, com 14 dias entre religar e partir.** Padrão, se o dono não disser a data (pergunta 12): desligar entre 16/12 e 20/12/2026, conferência completa no destino até 23/12, partida não antes de 06/01/2027. **Se a M8 usar a reserva de 22/12, a mudança passa para 26 a 30/12, a conferência no destino para até 02/01 e a partida para não antes de 16/01/2027; a selagem de 28/12 cai dentro da janela e só atrasa.** Se a data de partida não permitir, vale a outra ordem: a mudança antes da M8 e o ensaio no destino | M8 verde; o B2 conferido em tudo há menos de 7 dias | **Sim, e quem está no destino** | Abrir e concluir a mudança; uma conferência do B2 pelo Mac | A viagem. A selagem de 28/12 já acontece no destino, com o dono ainda no país |

**Encaixe que os revisores pediram por escrito.** A selagem de 28/11 depende de a tabela já estar particionada. Se a M2 escorregar para o limite de 30/11, a primeira selagem escorrega junto, e a meta do ensaio (15/12) fica sem folga: **o limite da M2 só vale remarcando a M3b e a M8 no mesmo ato.** A M8 é apertada: a M6 fecha em 05/12 e a M7 em 12/12, e a parte B pede dois dias seguidos de verificação antes do clique; a reserva até 22/12 é o que a segura. **Emenda de 14/10:** a M4 passou de 20/11 para 27/11, e a M5 e a M10b ficam com 8 dias depois dela, não 15. Se a aprovação dos desenhos passar de 27/11, a M10b usa a reserva de 12/12 e o passo 18 do ensaio (o primeiro congelamento) usa a de 22/12; a mudança de casa não espera por ele, porque congelar não depende da casa.

**Data de gatilho da dependência da E10.** A serialização única é a função `exportarUnidade`, das tarefas 5 e 6 da E10, que estão com 0% de código e sem data combinada. Com a mão do dono em casa só até dezembro, o calendário não pode ficar refém disso. **Se em 07/11/2026 as tarefas 5 e 6 da E10 não estiverem no `staging`, esta fase implementa `arquivo/csv.ts` e `arquivo/manifesto.ts` pelo contrato da tarefa 5 da E10, nos mesmos caminhos e com os mesmos testes (os de formato do item de aceite 19), mais a fonte e o `exportarUnidade` do pedido 2, e avisa o controlador da A5 no mesmo dia; a E10 passa a consumir.** A partir do aviso, a trilha da E10 para de implementar as tarefas 5 e 6, para não haver dois `arquivo/csv.ts`.

**Ordem de corte, se o calendário apertar** (do primeiro a ficar para depois da viagem ao último):

1. M9 (expurgo enxuto). **Com o item 12, este corte passou a ter um preço que só o dono aceita, e fica dito a ele assim:** "se a M9 for cortada, o arquivo de todo canal removido fica no NAS e no B2 até você voltar, fora da reconferência; a tela mostra, com a data". É o prazo de 30 dias que ele aceitou virando mais de 12 meses: a decisão de cortar é dele. Cortada a M9, toda remoção fica em "limpeza pedida", visível no bloco "Canais removidos" só de leitura (M5), sem cor de atraso até a data, e o passo 19 do ensaio sai junto (seção 13.3). E a M10c depende da M9: cortada a M9, a primeira retirada de vídeos antigos (fevereiro de 2027) também espera, e os vídeos seguem em leitura mensal, com o histórico no banco.
2. A tela do interruptor (ele não se arma antes de abril de 2027).
3. A peça 6 completa (fica o pedido mínimo).
4. O sinal sem serrote (só importa depois da primeira saída).

**Ordem de corte da emenda de 14/10** (própria, porque a etapa M10 é a que entrou por último; do primeiro a ficar para depois ao último):

1. Reativar um vídeo do arquivo e a marca "voltou a crescer" (já estão fora desta fase: seção 10.8).
2. A leitura mensal dos tocos. Sem ela o desenho continua correto; a tela diz "sem leitura desde dd/mm", e vídeo do arquivo que sair do YouTube não entra na fila.
3. A M10c inteira vai para 2027, com a classe liberada e o congelamento em produção. Nada sai; a coleta do catálogo velho já parou.
4. Os anexos de miniatura, numa segunda leva: a retirada fica travada até existirem (`anexo_pendente`), e o congelamento e todo o resto seguem.

**Nunca se corta:** M2, M3a, M3b, as funções de saída com a simulação, o carregador pelo `online desde`, a peça 2 com a 3, e as partes B e C do ensaio. **E, com a emenda de 14/10:** a classe na chave do registro e no caminho do arquivo (dentro da M3b); e, com o item 12, a árvore por canal, o resumo por canal e o destino do arquivo declarado na remoção de canal (a fatia 12a, também dentro da M3b: depois da primeira selagem, mudar o caminho é migrar arquivo nos dois lugares); a conferência do B2 pela forja, com o aviso de fora da casa provado (sem ela o dono, ausente por mais de um ano, teria uma execução manual por mês e toda saída dependeria dela); o estado e o roteiro da mudança de casa; e, se a M10b entrar, as telas da peça 8 junto. **O que escorrega sem custo e o que não escorrega:** a parte C (outubro real) pode passar de 28/11 se a M3b atrasar, porque os passos do dono nela são do Mac; "nunca se corta" não quer dizer "nunca se remarca". Se a peça 3 não estiver pronta até 10/12, os passos da parte B que exigem a casa (2 a 4, 10 e 11) são feitos e conferidos pela consulta do item de aceite 80, e os cliques (passos 7 e 8) ficam para depois, do Mac. A coluna "em casa" é a que não escorrega: a M3a em 15/11 e os ensaios de casa fora. **Emenda de 14/10: a mudança de casa também não escorrega para depois da partida,** e não se faz na semana de uma saída marcada. Se ela tiver de acontecer **antes** da M8, a M3a e a M3b são instaladas no destino, ou ao menos o ensaio da M8 é feito lá: a rede e a banda do destino mudam o tempo da cópia para o B2 e da conferência (seção 10.10).

**Outras dependências de outra trilha.** (1) A leitura de hora em hora precisa estar gravando em produção para existir mês horário a selar: é da E15. (2) As marcas de idade (`competitor_video_marks`, MG4) precisam existir antes da primeira saída das séries, em maio de 2027: a condição 9 da seção 10.5 recusa sem elas. (3) A troca do teto de 365 dias no carregador edita arquivos que as trilhas de tela da A5 mexem: pedido 11. (4) `obs_archive_is_site_admin`, que as funções de saída e o botão usam, é da E10 (MG6) e não existe em nenhuma migration hoje (F59): se não existir no dia da M3b, esta fase a cria ali (seção 10.5, pedido 13).

### 15.2 Relógio do dado

Nada aqui se adianta. Datas calculadas com a janela e a margem da seção 10.3.

| Data | O que acontece | Quem | De onde |
|---|---|---|---|
| 03/10/2026 | Começo da série diária (MEDIDO: F5) | n/a | n/a |
| 31/10/2026 | Outubro fecha | relógio | n/a |
| depois de o site passar a anotar as imagens do canal (M3b) e antes da primeira selagem: de 21/11 a 27/11/2026, se as metas se cumprirem (emenda de 14/10, item 12) | **Remover os canais de teste.** Nessa janela a remoção já anota as miniaturas do canal (`blobs_pending`) e ainda não existe arquivo dele: nasce `sem_arquivo`, sem nada a limpar no NAS nem no B2. **Antes de o site anotar as imagens, o botão só apaga o canal:** as miniaturas ficam no Blob, em URL pública, e o endereço delas some do banco na cascata. Quem remover antes recebe um arquivo de comandos e uma linha curta que o roda; a saída fica em `saidas/` (a consulta: `06` seção 19.4, P57). **Um fica, de propósito,** para o ensaio de `expurgar --canal` (seção 13.3, passo 19) | **dono, clique** | site |
| **28/11/2026** | **Primeira selagem devida:** série diária de outubro (29 dias medidos de 31). Se a leitura horária tiver começado a gravar em outubro, o mês horário de outubro também | copiador, sozinho | casa |
| dezembro de 2026, depois da M10b (emenda de 14/10) | **Primeiro congelamento:** os vídeos com mais de 24 meses que não estão entre os 50 mais recentes de cada canal passam à leitura mensal (148 hoje, em 3 canais: F63). É simulação e clique; dá para desfazer | **dono, clique** | site |
| 28/12/2026 | Selagem de novembro. **A primeira no destino,** se a mudança seguir o padrão (seção 15.1) | copiador, sozinho | casa |
| 28/01/2027 | Selagem de dezembro. A primeira com o dono fora. **Emenda de 14/10:** e a primeira selagem da parte "vídeos antigos" (o mês do congelamento de dezembro, com as miniaturas) | copiador, sozinho | casa |
| entre 28/01 e a primeira retirada (emenda de 14/10) | Ensaio de restauração de cada tabela da parte "vídeos antigos" que tenha registro (só existe mês selado com linha a partir de 28/01) | **dono** | Mac, de longe |
| fevereiro de 2027 (emenda de 14/10) | **Primeira retirada de vídeos antigos,** por clique e frase digitada. O tamanho do banco não cai: ele passa a crescer mais devagar. Nunca dentro de uma mudança aberta. **Um canal por vez, o menor primeiro** (hoje, o de 4 vídeos); o seguinte só no dia seguinte, depois de conferidas a consulta do item 80 e a de órfãs | **dono, clique** | site, de longe |
| duas vezes por dia | Verificação da cópia no NAS (validade de 24 horas) | copiador, sozinho | casa |
| uma vez por dia (emenda de 14/10) | Conferência do B2 pela forja (validade de 7 dias). **O comando mensal do dono deixou de ser obrigatório** | `conferir-b2`, sozinho | casa |
| a cada 180 dias (emenda de 14/10) | Ensaio de restauração de toda (classe, tabela) com registro. A sessão de fevereiro de 2027, que a parte "vídeos antigos" exige, é feita com `--todas` e passa a ser a referência de todas as partes: **são 2 sessões em 12 meses de ausência, 3 em 18** (fevereiro de 2027, agosto de 2027, fevereiro de 2028). Sem o `--todas` em fevereiro seriam 3 em 12 | **dono** | Mac, de qualquer lugar |
| a cada 30 dias, por vídeo (emenda de 14/10) | Leitura mensal de cada vídeo que passou à leitura mensal ou está no arquivo | agenda do site, sozinha | n/a |
| antes da primeira saída da leitura horária (01/02 ou 01/03/2027) | Ensaio de restauração da tabela `competitor_video_hourly`, com um mês horário real e com linha. **O da classe `ensaio` não vale para ela:** o ensaio é por tabela e pelas colunas dela. O primeiro mês horário real fica selado em 28/11 ou em 28/12, conforme a coleta comece em outubro ou em novembro; no segundo caso o ensaio cai perto da viagem e pode ser feito do Mac, de longe | **dono** | Mac |
| **01/02/2027** | **Primeira saída real: leitura horária de outubro de 2026** (novembro, dezembro e janeiro fechados). É o primeiro passo: o mês sai das telas. **Não pode cair dentro de uma mudança de casa aberta** (emenda de 14/10). **Só se houver leitura horária de outubro** (conferência CP6); se ela começar a gravar em novembro, a primeira saída é em 01/03/2027 | **dono, clique** | site, de longe |
| 08/02/2027 em diante | Segundo passo: o dono libera o espaço. Não acontece sozinho; aos 14 dias a página avisa. Até ele liberar, dá para trazer de volta, sem data limite | **dono, clique** | site |
| 01/03 e 01/04/2027 | Segunda e terceira saídas da leitura horária, cada uma com o segundo passo 7 dias depois | **dono, clique** | site |
| 01/03/2027 | **Portão de capacidade:** contar canais e refazer a seção 8 com as medidas reais (item de aceite 112) | agente e dono | n/a |
| abril de 2027 | Três saídas completas da leitura horária (a terceira fecha em 08/04): o automático desse tipo fica disponível (vale 90 dias depois de armado) | **dono, se quiser** | site |
| **01/05/2027** | **Primeira saída das séries: diária e primeiras horas de outubro de 2026** (novembro a abril fechados), em dois passos. A `early` só sai se já tiver ensaio próprio (seção 13.4), e conta as próprias três saídas em dois passos, mesmo que a diária já esteja na quarta (seção 10.5) | **dono, clique** | site |
| até 01/05/2027 | O ensaio de restauração da tabela diária precisa ter menos de 180 dias. O de dezembro de 2026 vale até junho de 2027 | **dono** | Mac |
| 01/06 e 01/07/2027 | Segunda e terceira saídas das séries | **dono, clique** | site |
| junho de 2027 | Vencem os ensaios de restauração de dezembro: refazer antes, para cada tabela | **dono** | Mac |
| julho e agosto de 2027 | Automático das séries disponível (a terceira saída fecha em 08/07). **A onda 2 (texto) é liberada em agosto:** o primeiro mês de comentários com 6 meses fechados depois dele pode sair, sempre por clique, com margem de 45 dias na selagem | **dono** | site |
| outubro de 2027 | Primeiro relatório de 12 meses com dado inteiro | n/a | n/a |
| a cada 90 dias | O interruptor vence e desliga | **dono, se quiser rearmar** | site |
| a cada migration que mudar coluna de tabela arquivável | O ensaio da tabela fica inválido; a saída trava até um novo | **dono** | Mac |

**Se a resposta à pergunta 2 for 12 meses** (e não 6): a primeira saída das séries passa de 01/05/2027 para **01/11/2027**, a onda 2 vai para 2028, e cabem cerca de 7 canais a menos em 3 anos (22 no lugar de 29: seção 8.5). A leitura de hora em hora não muda (3 meses, D3).

**O que o dono faz de longe, e com o quê** (emenda de 14/10: a lista completa, com a frequência, é a tabela da situação A da seção 13.6). Cliques no site; o ensaio de restauração no Mac, duas ou três vezes por ano, e, como reserva, a conferência do B2 (o B2 está na nuvem e a chave está no cofre: não dependem da casa; o ensaio os exercita uma vez fora da rede de casa, seção 13.3); e, pela rede privada, o que precisar na forja e no NAS, desde que as máquinas estejam ligadas. Com o item 12 entra nessa lista a limpeza do arquivo de um canal removido: `expurgar --canal`, no Mac, e colar na forja, pela rede privada, o que ele imprimir (seção 16.10). O que ele não faz de longe: ligar máquina desligada, trocar disco, religar o roteador. **Religar, quem faz é quem está na casa do irmão** (pergunta 4); trocar disco, ninguém (situação C da seção 13.6). O que acontece se a casa ficar desligada por muito tempo, com a folga em números (18 meses com 15 canais, 12 com 25, 8 com 50, contados de janeiro de 2027), está na seção 13.6.

## 16. O que é do dono rodar

**Regra.** Tudo no NAS, tudo na forja e todo `db:push:prod` são do dono. O agente nunca escreve lá: prepara os comandos, curtos, um por linha, e entrega no formato de sempre (um arquivo só com o caminho para a frente; o que já rodou vai para o histórico; volta atrás e explicação num runbook à parte). Os nomes de arquivo do kit e das migrations são fixados no plano; aqui estão os passos, na ordem. **"(clique)"** marca o que se faz na interface web do TrueNAS, do B2 ou da Vercel. Depois de cada bloco há uma linha de **conferência**, que é só leitura.

**Antes de todo `npm run db:push:prod` desta seção, uma conferência de leitura.** Várias trilhas commitam migrations no mesmo `staging`, e o `push` empurra tudo o que estiver pendente, inclusive migration de outra trilha, fora da vez dela:

```
npx supabase migration list --linked
```

**Só siga se as pendentes forem exatamente as que o passo a passo do dia lista pelo nome. Se houver outra, pare e avise.**

**Comandos com `sudo` na forja usam `ssh -t`:** sem terminal, o `sudo` falha se pedir senha. **NÃO VERIFICADO** se ele pede (conferência CP17).

### 16.1 M0: medidas (Mac)

As consultas CP1 a CP6 da seção 7.1, uma por linha, com a saída indo para `.superpowers/sdd/manutencao-nas/saidas/`. No navegador, o painel do B2: a regra de versões do bucket (CP7), com a captura da tela guardada. No Mac, as conferências CP17 e CP18. **Emenda de 14/10:** mais as três consultas da CP28 (Mac); no shell do TrueNAS, a CP21 e a CP22; no painel da rede privada, a CP23; e, na tela de configuração de cada máquina, a CP27.

### 16.2 M1: podas e espaço (Mac)

```
cd ~/Workspace/bythiagofigueiredo
```
```
npx supabase migration list --linked
```
```
npm run db:push:prod
```

Depois, fora das 05:30 e das 06:00 UTC (os três agendamentos do banco rodam nessas horas), **só se a conferência CP2 disser que o papel pode**. `vacuum` não roda dentro de transação. **Onde colar, por padrão: o SQL Editor do painel do Supabase.** Se ele recusar (`vacuum` dentro de bloco de transação), a alternativa é `psql` pela conexão "Session pooler", que é a via que o plano da dieta (E6 P3, Apêndice D) fixa para o `vacuum full` dela. **NÃO VERIFICADO** qual das duas aceita. Primeiro o comando leve:

```
vacuum (verbose) cron.job_run_details;
```

Conferência (leitura), no Mac:

```
npx supabase db query --linked "select pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as tabela, pg_size_pretty(pg_database_size(current_database())) as banco;"
```

Se a tabela continuar com dezenas de MB, a reescrita, pela mesma via:

```
vacuum full cron.job_run_details;
```

**Emenda de 14/10: se a reescrita for recusada, o dono aceitou esvaziar a tabela** (decisão D20; perdem-se 7 dias de histórico de execução do agendador interno, e nada mais). Só se a conferência CP2 disser que o papel pode esvaziar:

```
truncate table cron.job_run_details;
```

Se as duas forem recusadas, fica como está, registrado com a mensagem (item de aceite 6).

Repetir a conferência. A trava dura o tempo de regravar poucas linhas; o agendador interno só escreve nessa tabela quando um dos três agendamentos roda.

### 16.3 M2: partições (Mac)

Fora de 11:30 a 13:00 UTC e dos minutos 0, 20 e 40.

```
npx supabase migration list --linked
```
```
npm run db:push:prod
```

Conferência (leitura): as três tabelas viraram particionadas, as partições estão fora de `public`, sem acesso de `anon`, e há 12 meses à frente.

```
npx supabase db query --linked "select c.relname, c.relkind, (select count(*) from pg_inherits i where i.inhparent = c.oid) as particoes from pg_class c where c.oid in ('public.competitor_video_daily'::regclass, 'public.competitor_video_early'::regclass, 'public.competitor_video_hourly'::regclass);"
```
```
npx supabase db query --linked "select n.nspname, c.relname, c.relrowsecurity, has_table_privilege('anon', c.oid, 'select') as anon_le from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relispartition and n.nspname = 'obs_part' order by 2;"
```

Sete dias depois, a migration que remove as tabelas antigas: outra conferência das pendentes e outro `npm run db:push:prod`.

### 16.4 M3a: casa

**1. Antes de tudo, a chave.** Gerar uma senha e um sal longos no cofre de senhas; guardar os dois no cofre **e** numa cópia offline. Só depois criar a tarefa.

**2. NAS, antes de criar o dataset: tirar a pasta da tarefa antiga.** Assim a tarefa `SYNC` nunca chega a copiar o arquivo.

- **(clique)** Data Protection, Cloud Sync Tasks, "appdata -> B2", Edit: em Exclude, acrescentar `site-arquivo/**`.

**3. B2, no navegador** (só se o padrão da pergunta 1 for adotado: bucket próprio do arquivo):

- **(clique)** Criar um bucket **privado**, sem Object Lock, com Lifecycle Settings em "manter versões anteriores por 30 dias".
- **(clique)** Conferir que a credencial que o TrueNAS usa escreve nesse bucket (ou criar uma chave de aplicação de escrita restrita a ele, e cadastrá-la no TrueNAS).
- **(clique)** Criar uma chave de aplicação **só de leitura**, restrita ao bucket do arquivo, e guardá-la no cofre. É a que o Mac usa para conferir e restaurar.
- Guardar a captura da tela de Lifecycle Settings do bucket: o item de aceite 2 fecha com ela.

**4. NAS, na interface do TrueNAS** (versão 25.10.4; o nome exato de um campo pode variar, e o plano confere na tela antes de entregar o passo a passo):

1. **(clique)** Datasets, `fast/appdata`, Add Dataset: nome `site-arquivo`. Cifra: herdar do pai. "Quota para este dataset e os filhos" (`quota`): 20 GiB.
2. **(clique)** Dentro de `site-arquivo`, Add Dataset: `numerico`. "Quota para este dataset" (`refquota`): 10 GiB. De novo: `texto`, com 10 GiB. (ESTIMATIVA folgada: o arquivo de 75 canais por 5 anos, sem comprimir, ficaria em torno de 4 GB pela conta da seção 8.1. A `refquota` fica nos filhos, porque a do pai não os limitaria.)
3. **(clique)** Em cada um dos três datasets, Edit Permissions: dono `truenas_admin` (o usuário que o NFS mapeia), com escrita.
4. **(clique)** Shares, NFS, Add: caminho `/mnt/fast/appdata/site-arquivo/numerico`; hosts: `100.89.6.27` (a forja); usuário mapeado como nas outras exportações (`mapall truenas_admin`); sem "somente leitura". De novo, para `/mnt/fast/appdata/site-arquivo/texto`. **Uma exportação por filho; nenhuma do pai.**
5. **(clique)** Data Protection, Cloud Sync Tasks, Add: direção `PUSH`; modo de transferência **`COPY`**; origem `/mnt/fast/appdata/site-arquivo`; destino: o bucket da pergunta 1; Remote Encryption **ligada**, com a senha e o sal do cofre; Filename Encryption **desligada**; Exclude: `**/_recebendo/**`; diária.
6. **(clique)** Na tarefa nova: Dry Run. Conferir que lista só a pasta do arquivo.

**NAS, no shell** (as duas sentinelas; é escrita, é do dono):

```
touch /mnt/fast/appdata/site-arquivo/numerico/.arquivo-vivo
```
```
touch /mnt/fast/appdata/site-arquivo/texto/.arquivo-vivo
```

Conferência (leitura), no shell do TrueNAS:

```
zfs list -o name,used,avail,quota,refquota,encryption,mountpoint -r fast/appdata/site-arquivo
```
```
midclt call cloudsync.query | python3 -m json.tool | grep -E '"description"|"path"|"transfer_mode"|"encryption"|"filename_encryption"|"exclude"|"bucket"|"enabled"'
```
```
midclt call sharing.nfs.query | python3 -m json.tool | grep -E '"path"|"ro"|"hosts"|"mapall_user"|"enabled"'
```

**5. Forja** (o kit traz as quatro unidades de montagem, no molde de `mnt-biblioteca-pedidos.mount`):

```
ssh -t forja 'sudo mkdir -p /mnt/arquivo/escrita/numerico /mnt/arquivo/escrita/texto /mnt/arquivo/leitura/numerico /mnt/arquivo/leitura/texto'
```
```
scp ~/Workspace/forja/ferramentas/arquivo/mnt-arquivo-escrita-numerico.mount forja:/tmp/
```
```
scp ~/Workspace/forja/ferramentas/arquivo/mnt-arquivo-escrita-texto.mount forja:/tmp/
```
```
scp ~/Workspace/forja/ferramentas/arquivo/mnt-arquivo-leitura-numerico.mount forja:/tmp/
```
```
scp ~/Workspace/forja/ferramentas/arquivo/mnt-arquivo-leitura-texto.mount forja:/tmp/
```
```
ssh -t forja 'sudo install -m 644 /tmp/mnt-arquivo-*.mount /etc/systemd/system/'
```
```
ssh -t forja 'sudo systemctl daemon-reload'
```
```
ssh -t forja 'sudo systemctl enable --now mnt-arquivo-escrita-numerico.mount mnt-arquivo-escrita-texto.mount mnt-arquivo-leitura-numerico.mount mnt-arquivo-leitura-texto.mount'
```

Conferência (leitura; é a CP10):

```
ssh forja 'findmnt -t nfs4 -o TARGET,SOURCE,OPTIONS | grep arquivo'
```
```
ssh forja 'ls -la /mnt/arquivo/escrita/numerico/.arquivo-vivo /mnt/arquivo/escrita/texto/.arquivo-vivo /mnt/arquivo/leitura/numerico/.arquivo-vivo /mnt/arquivo/leitura/texto/.arquivo-vivo'
```

**6. A prova de escrita (CP16).** O arquivo gravado pela forja tem de aparecer **no NAS, dentro do filho**. É escrita, é do dono:

```
ssh forja 'touch /mnt/arquivo/escrita/numerico/.teste-escrita'
```

No shell do NAS (leitura):

```
ls -la /mnt/fast/appdata/site-arquivo/numerico/.teste-escrita
```
```
zfs list -o name,used -r fast/appdata/site-arquivo
```

Depois, apagar:

```
ssh forja 'rm /mnt/arquivo/escrita/numerico/.teste-escrita'
```

Repetir os quatro comandos trocando `numerico` por `texto`. **Se o arquivo não aparecer dentro do filho, pare:** vale o plano B da seção 9.4 (diretórios comuns num dataset só), e nada é instalado antes de a prova passar.

**7. Chaves de API** (Mac; hoje o script do kit conhece a chave `fila`; ele ganha os dois nomes novos no plano, com as permissões `archive_copy` e `archive_read`, e a forma final da linha é a do plano; o hash é o da chave que o dono gera e guarda). **Sem revogar nenhuma chave existente:** o script tem cláusula de revogação, e ela não é usada aqui.

```
bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh copiador <sha256>
```
```
bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh respondedor <sha256>
```

Conferência (leitura; é a CP5): a lista tem de mostrar as três chaves da forja ativas (`fila`, `copiador`, `respondedor`) e nenhuma revogada hoje.

```
npx supabase db query --linked "select name, permissions, revoked_at is null as ativa from pipeline_api_keys order by 1;"
```

**8. A conferência do B2 pela forja (emenda de 14/10; seção 10.9).**

- **(clique)** No painel do B2: criar uma chave de aplicação **só de leitura**, restrita ao bucket do arquivo, **só para a forja** (não é a do Mac nem a do TrueNAS: são três, revogáveis uma a uma), e guardá-la no cofre.
- **(clique)** No healthchecks.io: criar duas verificações, "Arquivo: conferência do B2" e "Arquivo: pulso", as duas com período de 24 horas e folga de 6; e uma terceira, "Arquivo: copiador", com período de 12 horas e folga de 3. Guardar as três URLs.

Forja. O `rclone` não está instalado (F77); a versão do repositório do sistema é a conferência CP25, e o plano fixa a mínima (se a do sistema não servir, o binário oficial, com o sha256 conferido):

```
ssh -t forja 'sudo apt-get install -y rclone'
```
```
ssh forja 'rclone version | head -1'
```

A cifra, **com a senha e o sal tirados do cofre, nunca copiados do TrueNAS**. Os `read -s` e os `rclone config create` têm de rodar na mesma sessão: o dono entra na forja e cola uma linha por vez (cada `read -s` pede o valor sem mostrá-lo):

```
ssh -t forja
```
```
read -s B2_CHAVE
read -s ARQ_SENHA
read -s ARQ_SAL
rclone config create b2arq b2 account=<id da chave de leitura da forja> key="$B2_CHAVE" hard_delete=false --obscure
rclone config create arq crypt remote=b2arq:<bucket>/<pasta> filename_encryption=off directory_name_encryption=false password="$ARQ_SENHA" password2="$ARQ_SAL" --obscure
unset B2_CHAVE ARQ_SENHA ARQ_SAL
chmod 700 ~/.config/rclone
chmod 600 ~/.config/rclone/rclone.conf
exit
```

Conferência (leitura): a forja lista a raiz do arquivo no B2, decifrada, e a configuração está fechada. **Se a lista sair ilegível, a chave do cofre não é a que o TrueNAS usa: pare.** É o erro que só apareceria no dia de restaurar.

```
ssh forja 'rclone lsf arq: --max-depth 1'
```
```
ssh forja 'stat -c "%a %n" ~/.config/rclone ~/.config/rclone/rclone.conf'
```

A terceira chave de API (Mac; o script do kit ganha o nome `conferidor`, com a permissão `archive_b2`; **sem revogar nenhuma chave existente**):

```
bash ~/Workspace/forja/ferramentas/seed_chave_forja.sh conferidor <sha256>
```

A conferência do passo 7 passa a mostrar quatro chaves da forja ativas (`fila`, `copiador`, `respondedor`, `conferidor`).

### 16.5 M3b: arquivo durável

Mac:

```
npx supabase migration list --linked
```
```
npm run db:push:prod
```

Na Vercel **(clique)**: a variável `OBS_ARQUIVO=on`, e um novo deploy para ela valer. **Antes de instalar o copiador:** sem ela as rotas respondem "arquivo desligado" e a selagem de 28/11 não acontece.

Forja (instalar o copiador; o kit termina em `git commit` local antes de qualquer cópia):

```
ssh -t forja 'sudo install -d -o thiago -g thiago /opt/arquivo /opt/arquivo/log'
```
```
scp -r ~/Workspace/forja/ferramentas/arquivo/copiador forja:/opt/arquivo/
```
```
scp ~/Workspace/forja/ferramentas/arquivo/copiador.env.modelo forja:/opt/arquivo/copiador.env.modelo
```
```
ssh forja 'cp -n /opt/arquivo/copiador.env.modelo /opt/arquivo/copiador.env'
```
```
ssh forja 'chmod 600 /opt/arquivo/copiador.env'
```

O modelo é copiado como `.modelo` e o `.env` nasce com `cp -n`, que não sobrescreve: uma reinstalação não apaga a chave. O dono edita `/opt/arquivo/copiador.env` na forja e cola a chave do copiador. Depois, uma execução à mão, sem escrever nada (o modo de prova do copiador só lê o plano e as montagens; **ele não prova a permissão de escrita, que é a prova da seção 16.4**):

```
ssh forja '/opt/agente/venv/bin/python -B /opt/arquivo/copiador/copiar.py --prova'
```

E a linha do cron, **acrescentada** ao crontab que já existe (o dono abre com `crontab -e` e cola; nunca `crontab -` com arquivo inteiro). Uma linha, duas execuções por dia, com 12 horas de distância: 03:17 e 15:17 no relógio da forja, que é `-03` (F51), ou seja **06:17 e 18:17 UTC**. O minuto 17 fica fora dos minutos de coleta (0, 20 e 40):

```
17 3,15 * * * flock -n /opt/arquivo/copiador.lock timeout -k 30s 40m /opt/agente/venv/bin/python -B /opt/arquivo/copiador/copiar.py --cron >>/opt/arquivo/log/copiador.err 2>&1
```

Conferência (leitura), no dia seguinte:

```
ssh forja 'tail -3 /opt/arquivo/log/copiador.jsonl'
```

**O `conferir-b2` (emenda de 14/10).** Instalado junto do copiador, com arquivo de ambiente próprio:

```
scp -r ~/Workspace/forja/ferramentas/arquivo/conferir-b2 forja:/opt/arquivo/
```
```
scp ~/Workspace/forja/ferramentas/arquivo/conferir-b2.env.modelo forja:/opt/arquivo/conferir-b2.env.modelo
```
```
ssh forja 'cp -n /opt/arquivo/conferir-b2.env.modelo /opt/arquivo/conferir-b2.env'
```
```
ssh forja 'chmod 600 /opt/arquivo/conferir-b2.env'
```

O dono edita `/opt/arquivo/conferir-b2.env` na forja: cola a chave `conferidor`, a URL da verificação "Arquivo: conferência do B2" e `OBS_ARQUIVO_CONFERIR_B2=on` (sem ela o programa não roda, e o site vê o silêncio). Uma execução à mão, que só lê o plano e o B2 e não informa nada:

```
ssh forja '/opt/agente/venv/bin/python -B /opt/arquivo/conferir-b2/conferir.py --prova'
```

A linha do cron, **acrescentada** como a do copiador (`crontab -e`). Uma execução por dia, às 11:07 no relógio da forja (14:07 UTC). **A hora é provisória:** tem de cair depois de a tarefa de cópia do NAS para o B2 terminar (conferência CP21, pergunta 17); o plano a fixa com a resposta:

```
7 11 * * * flock -n /opt/arquivo/conferir-b2.lock timeout -k 30s 40m nice -n 19 ionice -c3 /opt/agente/venv/bin/python -B /opt/arquivo/conferir-b2/conferir.py --cron >>/opt/arquivo/log/conferir-b2.err 2>&1
```

Os blocos novos do `pulso.sh` (copiador, conferência do B2 e pulso do arquivo) são instalados pelo instalador do kit, no molde do bloco da fila (ele recusa URL fora do formato do serviço e recusa instalar duas vezes); o comando exato é do plano. **Os blocos e as verificações da fila de inteligência não são tocados.**

Conferência (leitura), no dia seguinte:

```
ssh forja 'tail -3 /opt/arquivo/log/conferir-b2.jsonl'
```

### 16.6 M6 e M7: saída e período longo

Mac:

```
npx supabase migration list --linked
```
```
npm run db:push:prod
```

Forja (o respondedor, como serviço, no molde de `biblioteca-trabalhar.service`):

```
scp -r ~/Workspace/forja/ferramentas/arquivo/respondedor forja:/opt/arquivo/
```
```
scp ~/Workspace/forja/ferramentas/arquivo/arquivo-responder.service forja:/tmp/
```
```
ssh -t forja 'sudo install -m 644 /tmp/arquivo-responder.service /etc/systemd/system/'
```
```
ssh -t forja 'sudo systemctl daemon-reload'
```
```
ssh -t forja 'sudo systemctl enable --now arquivo-responder.service'
```

Conferência (leitura):

```
ssh forja 'systemctl show arquivo-responder -p ActiveState -p NRestarts -p ActiveEnterTimestamp'
```

Na Vercel **(clique)**, só quando o dono decidir armar o automático: `OBS_ARQUIVO_AUTO_DROP=on`. (`OBS_ARQUIVO` já foi ligada na seção 16.5.)

### 16.7 M8, e duas ou três vezes por ano: ensaiar a restauração; e, como reserva, conferir o B2 (Mac)

**Uma vez, os pré-requisitos do Mac.** São os dois comandos que o dono repete de longe; por isso o preparo está escrito, um por linha. **NÃO VERIFICADO** se o `docker` está instalado no Mac (conferência CP18).

```
brew install rclone
```
**A chave e a senha não são digitadas na linha de comando** (ficariam no histórico do shell, que entra no backup do Mac: é o que a seção 11.1 manda evitar). Rode uma linha por vez: cada `read -s` pede o valor sem mostrá-lo (cole do cofre e tecle Enter), e a última linha apaga as três variáveis.

```
read -s B2_CHAVE
read -s ARQ_SENHA
read -s ARQ_SAL
rclone config create b2arq b2 account=<id da chave de leitura> key="$B2_CHAVE" hard_delete=false --obscure
rclone config create arq crypt remote=b2arq:<bucket>/<pasta> filename_encryption=off directory_name_encryption=false password="$ARQ_SENHA" password2="$ARQ_SAL" --obscure
unset B2_CHAVE ARQ_SENHA ARQ_SAL
```

O `--obscure` manda o `rclone` ofuscar a senha que recebe em claro. Sem ele, uma senha longa em base64 pode ser tomada por senha já ofuscada e gravada errado (NÃO VERIFICADO: é o que a documentação do `rclone` descreve; a conferência abaixo pega o erro).

Conferência (leitura): lista os tipos de dado na raiz do arquivo.

```
rclone lsf arq: --max-depth 1
```
```
docker run --rm postgres:17 postgres --version
```

A conexão por onde os comandos gravam a atestação (precedente da E10, P1; o agente nunca vê o valor; de fora de casa pode ser preciso o pooler em modo sessão):

```
export OBS_ARQUIVO_DB_URL=<do chaveiro>
```

O `rclone.conf` fica com a senha e o sal: manter fora do backup do Mac, ou proteger com a senha de configuração do `rclone` (seção 11.1).

**Quando a forja não puder conferir, e uma vez depois da mudança de casa** (era "todo mês"; com a emenda de 14/10 quem confere todo dia é a forja, seção 10.9, e este comando fica de reserva). O comando do repositório faz o resto e é o único, fora a rota da forja, que grava a atestação. Toda execução deixa a tentativa registrada, mesmo a que falha. **Se ela acusar arquivo ausente ou arquivo diferente, a conferência anterior daquele mês é retirada na hora** e a saída trava até uma execução que dê certo (seção 10.4); chave ausente neste Mac e falha de acesso ao B2 não retiram: rode de novo no Mac que tem a chave. Além do mês pedido, o comando confere o mês já descartado que está há mais tempo sem conferência (seção 10.6):

```
npx tsx scripts/obs-arquivo.ts atestar-b2 --mes 2026-10 --classe serie --por <seu e-mail>
```

**A cada 180 dias por (classe, tabela), ou quando uma coluna mudar. É a obrigação que continua sendo do dono, duas ou três vezes por ano.** O ensaio de restauração (baixa do B2, decifra, sobe um Postgres 17 descartável em `docker`, carrega, compara, grava o resultado e descarta o banco). Ele recusa mês vazio e diz qual tabela restaurou. **Emenda de 14/10:** ele grava também uma conferência do B2, de origem "dono", para cada mês que baixou, e o site a compara com a última conferência e a última tentativa da forja para o mesmo mês e a mesma versão: se as duas discordarem, diz isso em vermelho e o automático é desligado (seção 10.9). Para cada (classe, tabela) ele escolhe o mês com registro que está há mais tempo sem conferência sua, os que já saíram do banco primeiro. Com `--todas` roda, uma de cada vez, toda (classe, tabela) com registro; é a forma de uso de quem está longe:

```
npx tsx scripts/obs-arquivo.ts ensaiar-restauracao --todas --por <seu e-mail>
```

Uma tabela só:

```
npx tsx scripts/obs-arquivo.ts ensaiar-restauracao --mes 2026-10 --tabela competitor_video_daily --por <seu e-mail>
```

**Só quando a cópia de um canal removido se perdeu** (seção 10.5). Antes, tenta-se recuperar o arquivo do B2, com os comandos do mês descartado (runbook, item de aceite 69). Só se o B2 também não tiver o arquivo bom é que o comando abaixo grava a perda: ele só aceita unidade de canal removido, baixa do B2 e confere antes de tudo, e pede uma frase digitada. Para a unidade que nunca chegou ao NAS (`nunca_recebida`) ele dispensa a tentativa no B2:

```
npx tsx scripts/obs-arquivo.ts declarar-perdida --unidade <id> --por <seu e-mail>
```

Sem `--unidade`, o comando lista as unidades de canal removido que esperam decisão, uma por linha, com id, canal, mês, tabela, registros e o motivo possível, e termina sem gravar. A linha de tela e o runbook mandam rodá-lo assim primeiro.

Os três recusam rodar se a entrada não for um terminal, como o `confirmar-nas` da E10. **Nenhum agente os roda.**

### 16.8 M8: o ensaio em produção

A ordem é a da tabela da seção 13.3. O que é do dono: a carga da tabela de ensaio (uma chamada de função em produção, com o mês como argumento):

```
npx supabase db query --linked "select public.obs_archive_rehearsal_seed('2026-03-01'::date);"
```

Os dois comandos da seção 16.7 para a classe `ensaio`; a conferência do B2 rodada uma vez sem a chave e de novo com ela (a primeira deixa a tentativa registrada e não retira a conferência anterior; a segunda grava a nova); os cliques no site (simular duas vezes, destacar, trazer de volta, destacar de novo, liberar o espaço no dia seguinte e, no fim de tudo, "Encerrar o dado de teste"); e os ensaios de casa fora, um de cada vez, religando ao final de cada um:

```
ssh -t forja 'sudo systemctl stop mnt-arquivo-escrita-numerico.mount'
```
```
ssh -t forja 'sudo systemctl start mnt-arquivo-escrita-numerico.mount'
```
```
ssh -t forja 'sudo systemctl stop arquivo-responder.service'
```
```
ssh -t forja 'sudo systemctl start arquivo-responder.service'
```

Para parar o copiador por um dia, o dono comenta a linha dele no crontab (`crontab -e`) e a descomenta depois.

O reinício da forja, uma vez, e a conferência de que as quatro montagens voltaram sozinhas:

```
ssh -t forja 'sudo systemctl reboot'
```
```
ssh forja 'findmnt -t nfs4 -o TARGET,SOURCE,OPTIONS | grep arquivo'
```

Por último, os dois comandos da seção 16.7 rodados **uma vez com o Mac fora da rede de casa** (pelo celular), antes da viagem, **e com a rede privada desligada no Mac:** a senha e o sal têm de vir de uma guarda que se lê sem o NAS (itens de aceite 107 e 154).

**Emenda de 14/10: os passos 14 a 18 do ensaio** (seção 13.3). O controle negativo e a falta de canário são provocados pelo modo de ensaio do `conferir-b2`, que o plano fixa; a falha do pulso, por uma chamada à URL de falha da verificação "Arquivo: pulso", com o celular fora da rede de casa. O reinício do NAS é **(clique)** na interface do TrueNAS, e a leitura depois dele:

```
zfs get -H -o name,value keystatus fast/appdata
```
```
ssh forja 'findmnt -t nfs4 -o TARGET,SOURCE | grep arquivo'
```

`available` na primeira e as quatro montagens na segunda: a casa volta sozinha. Qualquer outra resposta vai para o cartão de quem religa (seção 16.12). Depois, do Mac, o ensaio de todas as partes, com a duração anotada:

```
time npx tsx scripts/obs-arquivo.ts ensaiar-restauracao --todas --por <seu e-mail>
```

E, no site, o primeiro congelamento: "Ver o que passaria à leitura mensal", conferir os números contra a consulta da CP28, e "Passar estes vídeos à leitura mensal".

### 16.9 Passo de emergência: banco em modo somente leitura

Só se o banco passar de 500 MB. Os comandos são os documentados pelo Supabase (F38), no SQL Editor do painel, numa sessão só, e ficam no runbook desta fase: abrir a sessão para escrita, tirar o mês que estiver pronto, rodar `vacuum`, e religar a escrita por padrão. **O sinal de limite existe para este passo nunca ser usado.** Ele não é ensaiável (seção 13.5).

### 16.10 Expurgo (Mac)

Quando a fila "Saíram do YouTube" mostrar item com cópia no arquivo, ou cópia antiga de comentários a apagar (seções 11.3 e 14.7). São dois tempos (seção 11.3). O primeiro comando reescreve a unidade, o resumo e o manifesto do mês como versões novas e imprime, um por linha, **só o que copiar** para a forja. O segundo imprime o que apagar no NAS e no B2, e recusa enquanto as versões novas não estiverem recebidas e conferidas no B2. Com um mês fora das telas e o espaço por liberar, nenhum dos dois roda: libere o espaço ou traga o mês de volta antes.

```
npx tsx scripts/obs-arquivo.ts expurgar --item <id>
npx tsx scripts/obs-arquivo.ts expurgar --item <id> --apagar-antigas
```

**Limpar o arquivo de um canal removido (emenda de 14/10, item 12; seção 11.3).** Quando a página do Arquivo mostrar um canal em "limpeza pedida". O comando não baixa nem grava arquivo: lê o estado da remoção e imprime só o passo seguinte, um comando por linha. Rodar de novo é sempre seguro.

```
npx tsx scripts/obs-arquivo.ts expurgar --canal <channel_ref>
```

Primeiro ele imprime os `rm -r` de `<classe>/canais/<channel_ref>/`, um por classe, nos dois filhos, para o dono colar na forja, um por linha (a forma exata da linha é do plano). Depois de a forja informar, em duas passadas do copiador, que nenhum prefixo do canal existe mais no NAS, o mesmo comando imprime os prefixos a apagar no B2, pelo painel, em todas as versões; **só os imprime com esse informe com menos de 24 horas e sem mudança de casa aberta,** e fora disso diz "espera a conferência do NAS (última em dd/mm hh:mm)". Com mudança de casa aberta ele não imprime nada, nem os `rm -r`. A página do Arquivo mostra cada passo provado, e só diz "apagado" de um lugar depois da prova nele: "apagado do B2", só depois de a forja listar o B2 e não achar versão nenhuma. **NÃO VERIFICADO** se o painel do B2 apaga todas as versões de uma pasta ou só as esconde (conferência CP32): versão escondida conta como presente, e a limpeza não avança.

**Casa desligada.** Não há comando do dono para tirar mês sem a casa: esse caminho saiu do escopo (seção 19.3, J13). O que acontece e o que fazer está na seção 13.6.

### 16.11 A mudança de casa (emenda de 14/10)

O contrato está na seção 10.10: o site só deixa abrir a mudança com tudo copiado e o B2 conferido, e só deixa concluir com tudo conferido de novo no destino. Aqui estão os passos, na ordem. **Nada sai do banco entre o passo 2 de "antes" e o último de "no destino".**

**Antes, nas 48 horas anteriores (em casa).**

0. **(clique)** Encerrar o dado de teste, na página do arquivo (seção 14.2), se o ensaio completo já terminou: o mês de teste descartado só é conferido em rodízio, e o site não deixaria declarar a mudança.
1. Esperar uma passada do copiador **e** uma do `conferir-b2` com tudo verde, e anotar a hora. Leitura:

```
ssh forja 'tail -1 /opt/arquivo/log/copiador.jsonl'
```
```
ssh forja 'tail -1 /opt/arquivo/log/conferir-b2.jsonl'
```

2. **(clique)** Na página do arquivo: "Declarar mudança das máquinas", com a data de fim. O site recusa se faltar cópia, se o B2 de algum mês não tiver conferência com menos de 7 dias, ou se houver mês fora das telas. Abrir desliga o automático.
3. **(clique)** No healthchecks.io: pausar as verificações da fila, do copiador, da conferência do B2 e do pulso do arquivo, para o desligamento combinado não acordar ninguém. **Retirar a pausa é o penúltimo passo da volta.**
4. No shell do TrueNAS, uma verificação completa do pool, e esperar terminar limpa (tempo NÃO MEDIDO):

```
zpool scrub fast
```
```
zpool status fast
```

5. **(clique)** Desligar o NAS pela interface do TrueNAS (não cortar a energia). Depois, a forja:

```
ssh -t forja 'sudo systemctl poweroff'
```

**No destino, nesta ordem.** Cada passo tem a leitura que o destrava.

1. Energia, roteador e só então o NAS e a forja. Se as máquinas não ligarem sozinhas quando a energia volta (CP27), é pelo botão.
2. NAS: o pool sem erros e o dataset cifrado destravado (`available`). Se ele pedir a senha, é o dono que a dá, e isso vai para o cartão (seção 16.12). Depois, outra verificação completa do pool.

```
zpool status fast
```
```
zfs get -H -o name,value keystatus fast/appdata
```

3. A rede privada nas duas máquinas. As montagens usam o endereço da rede privada e não mudam com a rede local (F78); **o endereço de gerência remota do NAS é da rede local e muda:** reservá-lo no roteador novo.
4. As quatro montagens e as duas sentinelas; e a prova de escrita da seção 16.4, bloco 6, repetida.

```
ssh forja 'findmnt -t nfs4 -o TARGET,SOURCE | grep arquivo'
```
```
ssh forja 'ls -la /mnt/arquivo/escrita/numerico/.arquivo-vivo /mnt/arquivo/escrita/texto/.arquivo-vivo'
```

5. **(clique)** No TrueNAS, a tarefa de cópia para o B2: Run Now, uma vez, e conferir que terminou (é a primeira subida pela internet do destino).
6. Forja: o cron inalterado, os serviços no ar e o relógio certo.

```
ssh forja 'crontab -l | grep -c arquivo'
```
```
ssh forja 'systemctl is-active tailscaled arquivo-responder'
```
```
ssh forja 'date'
```

7. O copiador em modo de prova; depois uma execução de verdade; depois o `conferir-b2`, à mão:

```
ssh forja '/opt/agente/venv/bin/python -B /opt/arquivo/copiador/copiar.py --prova'
```
```
ssh forja 'flock -n /opt/arquivo/copiador.lock /opt/agente/venv/bin/python -B /opt/arquivo/copiador/copiar.py --cron'
```
```
ssh forja 'flock -n /opt/arquivo/conferir-b2.lock /opt/agente/venv/bin/python -B /opt/arquivo/conferir-b2/conferir.py --cron'
```

8. Do Mac, uma conferência do B2 pelo dono, do mês mais recente: é a conferência independente logo depois do trecho de maior risco físico.

```
npx tsx scripts/obs-arquivo.ts atestar-b2 --mes <o mais recente> --classe serie --por <seu e-mail>
```

9. Acompanhar na página do arquivo a conferência de tudo: no NAS, todos os arquivos; no B2, todos os arquivos; e a prova de que a cópia para o B2 voltou (até 48 horas). Arquivo que faltar no NAS é recuperado do B2 antes de concluir.
10. **(clique)** No healthchecks.io: retirar a pausa das quatro verificações. **(clique)** Na página do arquivo: marcar as quatro confirmações e "Concluir a mudança".
11. Só no dia seguinte a um ciclo completo (duas passadas do copiador e uma do `conferir-b2`): a primeira saída, se houver mês pronto; e ligar de novo o automático, se o dono quiser.

**Critério de "voltou":** a lista de meses sem nenhuma linha vermelha ou âmbar de cópia; verificação do NAS com menos de 24 horas; conferência do B2 pela forja com menos de 7 dias em todos os meses; e o batimento dos três programas recente. **Entre religar e partir: pelo menos 14 dias.**

### 16.12 Uma vez, antes de partir (emenda de 14/10)

O dono fica fora mais de 12 meses (D18). Cada linha abaixo é uma coisa que, esquecida, só aparece meses depois, sem erro de máquina. O item de aceite 155 fecha com a palavra dele.

| # | O que | Onde | Por quê |
|---|---|---|---|
| 1 | **Desligar a expiração da chave das duas máquinas na rede privada** | **(clique)** painel da rede privada | Chave vencida derruba as montagens; a casa fica "NAS fora" sem nenhum defeito (F78, CP23) |
| 2 | **A conta do B2:** e-mail que ele lê no exterior, segundo fator com caminho de recuperação, cartão em dia | **(clique)** painel do B2 | Perder o acesso ao B2 é perder a segunda cópia sem aviso |
| 3 | **A senha e o sal da cifra legíveis sem o NAS.** Entre os aplicativos do NAS há um cofre de senhas (`vaultwarden`, F25). **Se o cofre do dono é esse, com o NAS perdido o cofre vai junto,** e a cópia offline passa a ser a única guarda: ela tem de estar num lugar que ele alcance de longe. **Se for, o dono cria antes de partir uma segunda guarda fora da casa** (outro cofre, ou a cópia offline num lugar que ele alcance de longe), e o ensaio do passo 17 é feito com ela | conferência do dono (CP31) | É a chave sem a qual o B2 não se lê (R3). **NÃO VERIFICADO qual cofre ele usa** |
| 4 | **O aviso de fora da casa chegando ao celular, fora da rede de casa** | passo 15 do ensaio | Sem ele o dono viaja sem despertador |
| 5 | **O cartão impresso, na caixa do no-break:** a ordem de ligar (o NAS; esperar; a forja), o que olhar, para quem ligar; e, se o dataset cifrado pedir senha no reinício (CP22), que nesse caso a casa espera o dono | casa do irmão | É o que quem religa tem na mão (seção 13.6, situação B) |
| 6 | "Ligar quando a energia voltar", na configuração das duas máquinas | tela de configuração de cada uma (CP27) | Sem isso toda queda de luz precisa de alguém |
| 7 | **Um ensaio de restauração de todas as partes, o mais perto possível da partida** | Mac (`ensaiar-restauracao --todas`) | Os 180 dias contam dele: feito em 20/12, vale até meados de junho |
| 8 | **Nenhuma migration que mude coluna de tabela arquivável, durante a ausência, sem uma sessão de ensaio marcada logo depois** | repositório; checklist de migration | A mudança invalida o ensaio da tabela e trava a saída dela (seção 10.4) |
| 9 | Não atualizar o TrueNAS nem o sistema da forja entre o ensaio e a viagem; e, durante a ausência, só com um ensaio marcado depois | n/a | Risco R16 |
| 10 | **Os lembretes no calendário do celular** (clique de saída no dia 1; religar o automático a cada 80 dias; teste de recuperação 150 dias depois do último) | calendário do celular | O que o spec pede de você de longe só aparece quando você abre a página do Arquivo |
| 11 | **A lista "Canais removidos" sem nenhuma linha que peça um comando seu,** e o canal de teste do ensaio já limpo | página do arquivo | Pedido de limpeza esquecido antes da partida fica meses sem que ninguém o veja |
| 12 | **O aviso do limite do banco tem verificação própria no serviço de fora da casa** (não divide o aviso com os outros vermelhos do arquivo) | healthchecks.io e `pulso.sh` | Um vermelho antigo no pulso esconde o seguinte: o serviço só avisa quando o estado muda (P31) |

## 17. Pedidos ao controlador da A5

**Esta sessão não edita plano de outra trilha.** Os planos da A5 são trabalhados por outra sessão no mesmo `staging`. Cada item abaixo é um pedido, com o texto exato a acrescentar. **Os pedidos 15 a 18 entraram com a emenda de 14/10** (saída por idade do vídeo e mudança de casa; o 18 é do item 12: remover canal limpa também o arquivo). Os pedidos 5 e 6 são **condição de entrada da etapa M2**: se o controlador recusar ou demorar, a M2 converte as tabelas assim mesmo e esta fase neutraliza o risco do lado dela (dito em cada item).

**O que mudou no pedido com a medida de 13/10.** A direção previa pedir que `competitor_video_early` e `competitor_video_hourly` **nascessem particionadas**, caso ainda não existissem em produção. Elas existem e estão vazias (F5), criadas pelas migrations `20261012000003` e `20261013000002`, já aplicadas. Logo: **não se pede mais à A5 que edite essas migrations** (migration aplicada não se edita); a conversão das três tabelas é desta fase, na M2; e o que se pede à A5 é que o código que grava nelas continue compatível com tabela particionada (pedido 6).

**O que segura os pedidos 1 e 3 em qualquer ordem.** Esta fase entrega, na M2, um teste que lê as migrations e fica vermelho no CI se a última definição de `obs_archive_uncovered` ou de `obs_db_size_record` não souber de partição (seção 10.2). Vale mesmo que a E10 chegue depois da M2 e sem aceitar os pedidos. O mesmo teste segura o pedido 13: falha se uma migration desta fase referenciar `obs_archive_is_site_admin` sem que alguma migration a defina.

| # | Plano | Pedido | Texto exato a acrescentar | Se não entrar |
|---|---|---|---|---|
| 1 | E10, MG6, `obs_archive_uncovered()` | A função ignora partições | "No `select` final de `obs_archive_uncovered()`, acrescentar `and not c.relispartition`. O registro lista a tabela-mãe. Acrescentar à conferência V2 dois casos: uma tabela particionada de fantasia cuja partição mora em outro schema; e **uma tabela destacada (ex-partição, sem `relispartition`, sem chave estrangeira, com sufixo `_saida`)**. O resultado esperado continua `{}` nos dois." | A migration de partição desta fase recria a função com a cláusula, partindo do corpo instalado; se a função ainda não existir, o teste das migrations acusa no dia em que ela entrar sem a cláusula |
| 2 | E10, Tarefa 6 | Extrair a serialização de uma unidade, **sem SQL dentro** | "O passo 5 de `exportarCanal` passa a ser uma função exportada `exportarUnidade(fonte, disco, { tabela, canal, de, ate, rotulo })`, com contrato e teste próprios, em que `fonte` é `{ ler(): Promise<{ colunas, linhas: (string | null)[][], contagem, soma }> }`. `exportarCanal` vira o laço sobre ela, sem mudança de comportamento, e fornece a fonte pelo cursor que já tem (`consultaDoArquivo`). A fase de manutenção fornece a fonte pela função SQL `obs_archive_read_unit`, que é o leitor único da unidade mensal. **Os limites do período (`de`, `ate`) chegam como argumento**: o arquivo mensal usa o mês de São Paulo (o limite da partição), e o export de canal continua usando o período do registro." | **Data de gatilho, 07/11/2026:** se as tarefas 5 e 6 não estiverem no `staging`, esta fase escreve `arquivo/csv.ts`, `arquivo/manifesto.ts`, a fonte e o `exportarUnidade` com este contrato, nos caminhos que o plano da E10 fixa, e a E10 passa a consumir (seção 15.1) |
| 3 | E10, MG6 e Tarefa 3, `obs_db_size_record` | O tamanho soma partições | "`competitor_bytes` e `own_bytes` somam relações com `relkind in ('r','p')` e enxergam o schema `obs_part` (função `security definer` com `search_path` fixo). `top_relations` agrega as partições sob o nome da tabela-mãe, e soma também a tabela destacada (`_saida`) enquanto ela existir. Teste com tabela particionada cuja partição está fora de `public`: o tamanho da mãe não pode ser lido como zero." | Esta fase recria a função na migration de partição; até lá o sinal lê a menos, e o spec proíbe soltar mês com o sinal sem medida |
| 4 | E10, Tarefa 2, `sinalDoBanco` | Um ponto de encaixe para a previsão sem serrote | "`sinalDoBanco` aceita um argumento opcional `saidas: { dia, bytes }[]`. Ausente ou vazio, o comportamento é o de hoje (reta de 28 dias). A fase de manutenção passa as saídas e muda a previsão (spec da manutenção, seção 12.5)." | Esta fase emenda a função depois, com teste; a reta simples vale até a primeira saída, em fevereiro de 2027 |
| 5 | E16 e E15 parte 1 (linha 294 do plano); specs 00 (linhas 124, 411, 424) e 03 (linhas 46, 198, 452, 457) | **`OBS_HOURLY_RAW_PURGE` não nasce** | "A leitura crua de hora em hora não é apagada por idade por nenhuma rotina da A5. A variável `OBS_HOURLY_RAW_PURGE` é retirada do plano e dos specs; a linha 5 da lista fechada do que apaga (spec 06, 9.2) sai. A única saída dessa tabela por idade são as funções `obs_archive_detach_month`, `obs_archive_discard_month` e `obs_archive_drop_month` da fase de manutenção, que só tiram a partição com a cadeia verde (a quarta, `obs_archive_reattach_month`, traz de volta). O registro de dias somados não é podado: vive enquanto se quiser refazer o mapa." | Esta fase acrescenta um teste que falha se qualquer código ler `OBS_HOURLY_RAW_PURGE` |
| 6 | E15 e E2 (código que grava nas três séries) | Compatível com tabela particionada | "Todo `upsert` nas três tabelas usa `onConflict` pelas colunas da chave primária (`video_id` e a coluna de tempo), nunca `on conflict on constraint <nome>`. Nenhum índice único novo sem a coluna de tempo. Nenhuma chave estrangeira nova apontando para elas. **Hora cuja gravação falhar por falta de partição é registrada como lacuna, nunca como 'ok'.**" | A M2 confere por consulta (F7, com `pg_depend`) antes de converter e recusa se achar dependente novo |
| 7 | E10, texto do plano | Uma frase para ninguém misturar os dois registros | "Arquivo por idade não usa `obs_archive_batches`: vive em `obs_archive_units` e `obs_archive_months`, da fase de manutenção. `RULES.archiveCutMonths` (12) só alimenta a sugestão de canal parado; **não é a janela do arquivo**, que é constante do banco, por classe (6 para séries e texto, 3 para a leitura horária). **O lote de um canal exportado não traz o mês que já saiu do banco nem o mês destacado** (o export lê a tabela-mãe): quem restaurar um canal removido precisa do lote e do arquivo mensal; o plano não promete 'tudo do canal'." | Risco de leitura errada; sem efeito em código |
| 8 | E10, Tarefa 10 (lista fechada do que apaga) | Reservar as linhas desta fase | "A fase de manutenção acrescenta à lista, no commit em que cada uma nascer: destacar, descartar e apagar por faixa em `obs_archive_detach_month`, `obs_archive_discard_month` e `obs_archive_drop_month` (`obs_archive_reattach_month` não apaga linha nenhuma); poda de `yt_own_collection_attempts`; poda de `obs_archive_requests` e de `obs_archive_results`, e a expulsão do resultado mais antigo pelo teto de 8 MB. **Os gatilhos `before delete` e `before truncate` desta fase em `competitor_videos` e `competitor_channels` não apagam: recusam** (pedido 14). O teste passa a reconhecer `drop table` e `detach partition` em função SQL chamada pelo código varrido." | Esta fase estende o teste quando ele existir |
| 9 | E9 | Dono do caminho de dois passos, e a lista de arquivos do item | "`archive_pending`, os botões 'Ver os comandos' e 'Já rodei' e a frase 'N espera você rodar os comandos' são da fase de manutenção (etapa M9). A E9 continua gravando `archive_pending = false` até lá. **A partir da M9, o 'apagar' grava em `competitor_removed_items`, antes da cascata, a lista (tabela, mês) com linha do item que tenha unidade registrada em qualquer versão e, quando o item é um vídeo, o id interno dele (`competitor_videos.id`), que some na cascata;** a função que monta a lista é da fase de manutenção e a E9 só a chama. **O 'apagar' passa a poder ser recusado pelo banco com `mes_destacado_em_transito`** (pedido 14): a E9 trata a recusa como estado da fila, não como erro, e nada é gravado em `competitor_removed_items` nesse caso." | A fase de manutenção acrescenta a chamada no caminho do "apagar", em commit combinado |
| 10 | E10, export de canal (a considerar) | O vínculo com canal acompanhado no export de comentário novo | "No export de canal, `featured_channel_id` de comentário com menos de 28 dias desde `first_seen_at` é exportado como nulo, como o online o deixará aos 28 dias." | Fica como risco registrado (seção 19.3): o arquivo de um canal removido guardaria um vínculo que o online já não guarda |
| 11 | Trilhas de tela da A5 (`apps/web/src/lib/youtube/observatorio/load.ts` e `series.ts`; `load-channel.ts` importa `dailyReadFrom` de `load.ts`, e `load-page.ts` chega a ele por `loadLiveRows`: os dois são cobertos pela mesma troca) | Janela combinada para a troca do teto de 365 dias | "A troca do teto de 365 dias pelo `online desde` em `load.ts` e `series.ts` é feita pela fase de manutenção, em um commit só, em janela combinada com o controlador da A5; até lá nenhuma trilha muda `dailyReadFrom` nem `truncated`." | A fase faz a troca assim mesmo, depois de reler os dois arquivos no dia, e resolve o conflito no próprio commit |
| 12 | Registro de decisões da A5 | Alinhar a janela, depois da resposta do dono | "Confirmada a janela pelo dono (pergunta 2 do spec da manutenção), emendar a decisão 67 (c) em `.superpowers/sdd/a5/decisoes-do-dono.md` e a linha 32 do spec 06 da A5, que hoje dizem '12 meses online'." | Os dois registros continuam divergindo; o que vale em código é a constante do banco |
| 13 | E10, MG6, `obs_archive_is_site_admin` | A função que a condição 11 do portão usa não muda de nome nem de regra | "`obs_archive_is_site_admin(p_site, p_by)` é usada pelas funções de saída da fase de manutenção (condição 11 da seção 10.5 daquele spec) e pelo botão. Depois de aplicada, não renomear nem mudar a regra (administrador da organização do site ou de uma organização raiz) sem avisar a fase de manutenção. Se a M3b da manutenção chegar antes da MG6, a manutenção cria a função com esta mesma assinatura e esta mesma regra, com `create or replace`; a MG6 passa a encontrá-la criada e mantém `create or replace`." | Esta fase cria a função na M3b se ela não existir, e o teste que lê as migrations falha se alguma migration desta fase a referenciar sem que alguma a defina (item de aceite 119) |
| 14 | E9 (o "apagar" da fila), E10 (tarefa 11b, `removerCanalArquivado` e `competitor_channel_remove_archived`) e o botão "Remover canal" de hoje (`removeCompetitorChannel`) | Tratar a recusa do invariante do mês destacado | "A fase de manutenção instala gatilhos `before delete` e `before truncate` em `competitor_videos` e `competitor_channels` que recusam com a exceção `mes_destacado_em_transito` (os meses vêm no `detail`) enquanto houver mês com `detached_at` preenchido e `dropped_at` nulo em `obs_archive_months`. Todo caminho que apaga vídeo ou canal: (a) reconhece essa exceção e devolve à tela o estado 'remoção bloqueada', com o mês, em vez de erro genérico. A mensagem da exceção é exatamente `mes_destacado_em_transito`, com `SQLSTATE P0001`, sem o prefixo `E10:`: `codigoE10` e o tipo `Desfecho` da E9 ganham um membro próprio, senão ela cai em `inesperado` e em `erro`. O comando `remover` da E10 imprime a mesma frase; (b) não deixa efeito pela metade: o que grava antes do `delete` (`competitor_removed_items`, `audit_log`, `deleted_at` do lote, `blob_urls_pending`) fica na mesma transação do `delete`, ou é desfeito na recusa; (c) a exportação da E10 continua permitida com mês destacado, só a remoção espera; (d) nenhum teste ou rotina **da A5** desliga os gatilhos (os itens de aceite 126 (c) e 115 (f) da fase de manutenção desligam um, dentro do teste); (e) nenhum caminho que apaga vídeo ou canal abre transação acima de `read committed`: em `repeatable read` o gatilho não enxerga o destaque (medido), e um impasse com um destaque em andamento (`deadlock detected` é `SQLSTATE 40P01`) vira 'tente de novo', sem efeito. Fora do destaque nada muda." | A fase de manutenção faz o tratamento no botão de hoje (M6) e, na E9 e na E10, a recusa chega como erro genérico: nada é apagado, mas a tela não diz por quê |
| 15 | Trilhas de coleta e de tela da A5 (`competitor-sync.ts`, `competitor-tiers.ts`, `competitor-capture.ts`, `apply_competitor_tier_plan`, `competitor_series_health`, `load.ts`, `load-channel.ts`, a ação de fixar vídeo, `competitor_channel_removal_impact`) | **(Emenda de 14/10.)** A coleta e os carregadores respeitam o vídeo que passou à leitura mensal, em janela combinada | "A fase de manutenção acrescenta a `competitor_videos` as colunas `archive_frozen_at` e `archive_dropped_at` e um predicado único, `estaCongelado`. Em janela combinada com o controlador da A5, ela edita os oito pontos da lista (classificação de faixas e passada diária; passada semanal e a conta que a fecha; caminho da página de uploads; fechamento da faixa; prova da série, com a chave nova `arquivados`; carregadores; fixar; contagens da remoção de canal). Daí em diante, todo código novo da A5 que leia `competitor_videos` entra na lista `leitores-competitor-videos.ts` dizendo o que faz com o vídeo congelado, e toda migration nova que cite a tabela também: o teste da manutenção falha sem isso. Nenhuma trilha grava nas 8 tabelas da classe `video_antigo` para vídeo com `archive_frozen_at` preenchido: o banco recusa com `video_congelado`." | A fase faz a edição assim mesmo, relendo os arquivos no dia e resolvendo o conflito no próprio commit; código novo da A5 fora da lista quebra o teste no CI |
| 16 | E9 (fila "Saíram do YouTube") e E1 (captura) | **(Emenda de 14/10.)** A ausência e o "apagar" de um vídeo que está no arquivo | "Para vídeo com `archive_frozen_at` preenchido, a ausência detectada grava só `missing_since` na linha do vídeo e o item na fila; não chama o caminho que grava em `competitor_field_versions` (`markMissing`). O 'apagar' de um vídeo que está no arquivo grava em `competitor_removed_items` a lista (classe, tabela, mês) calculada de `archive_frozen_at`, pela função da fase de manutenção; a lista ganha a classe para todos os itens. Fixar um vídeo com `archive_dropped_at` preenchido é recusado com a frase 'este vídeo está no arquivo'." | A guarda de `insert` recusa a gravação em `competitor_field_versions`, alto e por vídeo; a ausência fica sem fila até o conserto |
| 17 | Fila de inteligência (runbook e vigia da forja) e quem cria tarefa com `target_video_id` | **(Emenda de 14/10.)** A janela de mudança de casa, e o vídeo congelado como alvo de tarefa | "O vigia da fila de inteligência lê `obs_archive_move`: com mudança aberta, o silêncio da fila é 'mudança declarada até dd/mm', não alarme. Vídeo com `archive_frozen_at` preenchido é **alvo indisponível** para a fila, nos três pontos: a criação da tarefa recusa (`forja-queue.ts:215`); a leitura dos dados da tarefa (`readSent`) devolve o mesmo 422 não repetível de "o vídeo não existe mais" e a tarefa fecha como recusada, com o motivo `video_congelado`, **antes de o modelo rodar**; e `completeReading` traduz a exceção `video_congelado` da guarda para esse 422, nunca para 500. Uma tarefa sobre vídeo congelado nunca roda o modelo duas vezes. A criação recusa com frase ("este vídeo está em leitura mensal: não há leitura nova dele pela forja"), nos dois lugares que criam a tarefa (a ação do CMS e a inserção de `leitura-video` em `forja-queue.ts`). E a publicação da leitura trata a exceção `video_congelado` como recusa terminal da tarefa (`refused`, com `refused_reason = 'video_congelado'`), nunca como erro 500: um teste afirma que esse ramo não é atingido. E vídeo com tarefa aberta não é congelado (item 8 da elegibilidade, seção 10.8). **Nenhum orçamento da fila muda** (20 min, `25m`, 30 min, 70 min)." | O dono pausa a verificação da fila à mão durante a mudança (roteiro da seção 16.11). A fase faz a edição em `forja-queue.ts` no próprio commit da M10b. **É condição do passo 4 da ordem de entrada** (seção 10.8): sem ela em produção, nenhum vídeo é congelado |
| 18 | Plano da E9 (linha 10, que diz que o botão "continua como é"); E9 (`competitor_channel_purge`); E10 (`competitor_channel_remove_archived`, o lote do canal e a restauração dele); e o concluidor de Blob | **(Emenda de 14/10, item 12.)** Remover canal declara o destino do arquivo, por uma função só. **Contraria o plano da E9,** que mantinha o botão como é | "O botão 'Remover canal' deixa de 'continuar como é': a fase de manutenção troca o `.delete()` de `actions.ts:162` pela função `competitor_channel_remove(p_site, p_channel, p_decision, p_via, p_actor)`, que grava a remoção em `obs_archive_channel_removals`, marca as unidades e os resumos do canal no arquivo e só então apaga. A E9 (`competitor_channel_purge`) e a E10 (`competitor_channel_remove_archived`) passam a chamá-la: um gatilho `before delete` em `competitor_channels` recusa, com `destino_do_arquivo_nao_declarado`, o apagamento de canal com unidade no arquivo e sem a declaração na mesma transação. A E10 passa a decisão como parâmetro obrigatório (`guardar` só existe com `p_via = 'e10_export'`) e ganha o apagar do lote do canal; a remoção com exportação gera o resumo do canal antes do `delete`; restaurar o lote de canal com decisão `apagar` é recusado (`canal_apagado`); e a E10 define se a restauração do lote de um canal guardado cria uuid novo (se o canal voltar com o mesmo uuid, a consulta de vigia 'remoção cujo canal ainda existe' acusa). O concluidor de Blob lê `blobs_pending` da remoção. O item `kind = 'canal'` da fila da E9 não tem `archive_pending` próprio: mostra o estado da remoção ligada (`removed_item_id`)." | A fase de manutenção faz a troca no botão de hoje, na M3b. Na E9 e na E10, enquanto não chamarem a função, o gatilho recusa o apagamento de canal que tenha unidade no arquivo: nada se perde, e a remoção por esses dois caminhos fica bloqueada até o conserto |
