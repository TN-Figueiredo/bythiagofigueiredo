# Fase de manutenção de dados (NAS e forja): spec, parte 05: calendário, o que é do dono rodar e pedidos à A5

> Parte do spec de 13/10/2026. Índice e marcas de fato: [`00-indice.md`](00-indice.md).

## 15. Calendário

Duas colunas que não se misturam. **Entrega** é construir, promover, instalar e ensaiar: tudo em 2026, o mais cedo possível, na ordem de dependência (D11). **Relógio do dado** é o que só acontece quando a linha tem idade: não se adianta, e depois de janeiro é feito pelo dono no site, de longe.

### 15.1 Entrega

As datas são metas, na ordem de dependência. O limite duro é um só: **tudo o que exige o dono em casa pronto até 15/12/2026, com reserva até 22/12** (pergunta 3 da seção 20). A mão do dono aparece em duas colunas, porque são coisas diferentes: **"em casa"** é o que exige estar em casa ou com a casa ligada (NAS, forja); **"do Mac"** é o que ele faz de qualquer lugar (`db:push:prod`, cliques no site e na Vercel, B2, ensaio de restauração).

| Etapa | O que entrega | Meta | Depende de | Dono, em casa | Dono, do Mac | O que destrava |
|---|---|---|---|---|---|---|
| **M0. Medidas que faltam** | As conferências da seção 7 e as respostas da seção 20 | 20/10/2026 | nada | CP8 (shell do NAS) | Seis consultas de leitura; o painel do B2 (regra de versões) | M1 e M3a |
| **M1. Podas e espaço** | Poda de `cron_runs` e de `yt_own_collection_attempts` (90 dias); recuperação de `cron.job_run_details` | 31/10/2026 | CP2 e CP3 | Não | `db:push:prod`; o comando que reescreve a tabela | 49 MB de uma vez e cerca de 36 MB por ano; não depende do NAS |
| **M2. Partições** | As três séries particionadas por mês; `obs_part`; `obs_partitions_ensure` com chamador; o invariante "meses à frente" lido pelo vigia da agenda; a tabela de ensaio; o teste que lê as migrations (seção 10.2) | 07/11/2026 (limite: 30/11) | Pedidos 1, 3, 5 e 6 da seção 17 | Não | `db:push:prod`, na janela | **É imediata:** `early` e `hourly` estão vazias e `daily` tem 1 MB (F5). Cada semana de leitura horária gravando encarece a troca |
| **M3a. Casa** | Exclusão na tarefa antiga; bucket; dataset e os dois filhos, com `refquota`, dono e permissão; uma exportação NFS por filho; tarefa de cópia `COPY` cifrada; chave no cofre; quatro montagens; duas sentinelas; a prova de escrita (CP16); duas chaves de API | 15/11/2026 | Pergunta 1 (regra de versões do bucket) | **Sim, toda ela** | As duas chaves de API | M3b |
| **M3b. Arquivo durável** | Registro (`obs_archive_units`, `obs_archive_months` e as demais); política; rotas; a serialização única e o leitor único; `hash_conteudo` e `schema_fp`; o copiador; a medida de atraso; o resumo mensal; `OBS_ARQUIVO=on` | Código em produção até 21/11; copiador instalado até 25/11 | M2; as tarefas 5 e 6 da E10 (formato e `exportarUnidade`: pedido 2), **ou o gatilho de 07/11/2026 abaixo** | Instalar o copiador | `db:push:prod`; a variável na Vercel | A primeira selagem real, em 28/11 |
| **M4. Mockups** | As sete peças da seção 14; o mockup 19 (nasce do zero); o `18-v2`; a tabela de sincronia (seção 14.9) | Começa já, em paralelo; aprovados até 20/11/2026 | nada | Não | Aprovar cada um | M5 |
| **M5. Telas** | O carregador pela janela real (`online desde`); "no arquivo"; os outros leitores das séries (seção 14.1); a página do arquivo; o aviso de limite ajustado | 05/12/2026 | M3b, M4; pedido 11 | Não | Não | A classe `serie` fica liberada para sair (condição 1 da seção 10.5) |
| **M6. Saída** | `obs_archive_detach_month`, `discard`, `reattach` e `drop`; a regra dos dois passos no banco, por tabela; os gatilhos do invariante do mês destacado, e a frase da recusa no botão "Remover canal" (seção 10.5, pedido 14); a simulação; o botão; o interruptor (desligado) e a tarefa da agenda; o rodízio de reconferência dos meses descartados; o sinal sem serrote; e `obs_archive_is_site_admin`, **criada por esta fase se a E10 ainda não a tiver criado** (seção 10.5, pedido 13) | 05/12/2026 | M3b, M4 | Não | `db:push:prod` | O clique |
| **M7. Período longo** | Fila, respondedor, resultado, a peça 6 | Instalado até 12/12/2026 | M3b | Instalar o serviço | Não | O relatório. Já há o que ler desde 28/11: os meses selados existem no arquivo mesmo antes de saírem do online |
| **M8. Ensaio completo** | As partes A, B e C da seção 13, com a restauração a partir do B2, os ensaios de casa fora, o reinício da forja, a chave ausente e os comandos do dono rodados fora da rede de casa | Passos 1 a 6 da parte B a partir de 26/11; tudo até 15/12/2026 (reserva: 22/12) | M3 a M7 (só o passo 9 depende da M7) | **Sim** | Conferir o B2; ensaiar a restauração | A viagem |
| **M9. Expurgo enxuto** | `archive_pending`, a lista de arquivos do item, "Ver os comandos", "Já rodei", o comando `expurgar`, o amarelo aos 30 dias | 12/12/2026 | M3b; a E9 em produção | Não | Não | Fecha a lacuna da E9 |

**Encaixe que os revisores pediram por escrito.** A selagem de 28/11 depende de a tabela já estar particionada. Se a M2 escorregar para o limite de 30/11, a primeira selagem escorrega junto, e a meta do ensaio (15/12) fica sem folga: **o limite da M2 só vale remarcando a M3b e a M8 no mesmo ato.** A M8 é apertada: a M6 fecha em 05/12 e a M7 em 12/12, e a parte B pede dois dias seguidos de verificação antes do clique; a reserva até 22/12 é o que a segura.

**Data de gatilho da dependência da E10.** A serialização única é a função `exportarUnidade`, das tarefas 5 e 6 da E10, que estão com 0% de código e sem data combinada. Com a mão do dono em casa só até dezembro, o calendário não pode ficar refém disso. **Se em 07/11/2026 as tarefas 5 e 6 da E10 não estiverem no `staging`, esta fase implementa `arquivo/csv.ts` e `arquivo/manifesto.ts` pelo contrato da tarefa 5 da E10, nos mesmos caminhos e com os mesmos testes (os de formato do item de aceite 19), mais a fonte e o `exportarUnidade` do pedido 2, e avisa o controlador da A5 no mesmo dia; a E10 passa a consumir.** A partir do aviso, a trilha da E10 para de implementar as tarefas 5 e 6, para não haver dois `arquivo/csv.ts`.

**Ordem de corte, se o calendário apertar** (do primeiro a ficar para depois da viagem ao último):

1. M9 (expurgo enxuto).
2. A tela do interruptor (ele não se arma antes de abril de 2027).
3. A peça 6 completa (fica o pedido mínimo).
4. O sinal sem serrote (só importa depois da primeira saída).

**Nunca se corta:** M2, M3a, M3b, as funções de saída com a simulação, o carregador pelo `online desde`, a peça 2 com a 3, e as partes B e C do ensaio. **O que escorrega sem custo e o que não escorrega:** a parte C (outubro real) pode passar de 28/11 se a M3b atrasar, porque os passos do dono nela são do Mac; "nunca se corta" não quer dizer "nunca se remarca". Se a peça 3 não estiver pronta até 10/12, os passos da parte B que exigem a casa (2 a 4, 10 e 11) são feitos e conferidos pela consulta do item de aceite 80, e os cliques (passos 7 e 8) ficam para depois, do Mac. A coluna "em casa" é a que não escorrega: a M3a em 15/11 e os ensaios de casa fora.

**Outras dependências de outra trilha.** (1) A leitura de hora em hora precisa estar gravando em produção para existir mês horário a selar: é da E15. (2) As marcas de idade (`competitor_video_marks`, MG4) precisam existir antes da primeira saída das séries, em maio de 2027: a condição 9 da seção 10.5 recusa sem elas. (3) A troca do teto de 365 dias no carregador edita arquivos que as trilhas de tela da A5 mexem: pedido 11. (4) `obs_archive_is_site_admin`, que as funções de saída e o botão usam, é da E10 (MG6) e não existe em nenhuma migration hoje (F59): se não existir no dia da M6, esta fase a cria (seção 10.5, pedido 13).

### 15.2 Relógio do dado

Nada aqui se adianta. Datas calculadas com a janela e a margem da seção 10.3.

| Data | O que acontece | Quem | De onde |
|---|---|---|---|
| 03/10/2026 | Começo da série diária (MEDIDO: F5) | n/a | n/a |
| 31/10/2026 | Outubro fecha | relógio | n/a |
| **28/11/2026** | **Primeira selagem devida:** série diária de outubro (29 dias medidos de 31). Se a leitura horária tiver começado a gravar em outubro, o mês horário de outubro também | copiador, sozinho | casa |
| 28/12/2026 | Selagem de novembro | copiador, sozinho | casa |
| 28/01/2027 | Selagem de dezembro. A primeira com o dono fora | copiador, sozinho | casa |
| duas vezes por dia | Verificação da cópia no NAS (validade de 24 horas) | copiador, sozinho | casa |
| todo mês | Conferência do B2 (validade de 35 dias) | **dono** | Mac, de qualquer lugar |
| antes da primeira saída da leitura horária (01/02 ou 01/03/2027) | Ensaio de restauração da tabela `competitor_video_hourly`, com um mês horário real e com linha. **O da classe `ensaio` não vale para ela:** o ensaio é por tabela e pelas colunas dela. O primeiro mês horário real fica selado em 28/11 ou em 28/12, conforme a coleta comece em outubro ou em novembro; no segundo caso o ensaio cai perto da viagem e pode ser feito do Mac, de longe | **dono** | Mac |
| **01/02/2027** | **Primeira saída real: leitura horária de outubro de 2026** (novembro, dezembro e janeiro fechados). É o primeiro passo: o mês sai das telas. **Só se houver leitura horária de outubro** (conferência CP6); se ela começar a gravar em novembro, a primeira saída é em 01/03/2027 | **dono, clique** | site, de longe |
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

**Se a resposta à pergunta 2 for 12 meses** (e não 6): a primeira saída das séries passa de 01/05/2027 para **01/11/2027**, a onda 2 vai para 2028, e cabem cerca de 9 canais a menos em 3 anos (seção 8.2). A leitura de hora em hora não muda (3 meses, D3).

**O que o dono faz de longe, e com o quê.** Cliques no site; a conferência mensal do B2 e o ensaio de restauração no Mac (o B2 está na nuvem e a chave está no cofre: não dependem da casa; o ensaio os exercita uma vez fora da rede de casa, seção 13.3); e, pela rede privada, o que precisar na forja e no NAS, desde que as máquinas estejam ligadas. O que ele não faz de longe: ligar máquina desligada, trocar disco, religar o roteador (pergunta 4). O que acontece se a casa ficar desligada por muito tempo, com a folga em números (18 meses com 15 canais, 12 com 25, 8 com 50, contados de janeiro de 2027), está na seção 13.6.

## 16. O que é do dono rodar

**Regra.** Tudo no NAS, tudo na forja e todo `db:push:prod` são do dono. O agente nunca escreve lá: prepara os comandos, curtos, um por linha, e entrega no formato de sempre (um arquivo só com o caminho para a frente; o que já rodou vai para o histórico; volta atrás e explicação num runbook à parte). Os nomes de arquivo do kit e das migrations são fixados no plano; aqui estão os passos, na ordem. **"(clique)"** marca o que se faz na interface web do TrueNAS, do B2 ou da Vercel. Depois de cada bloco há uma linha de **conferência**, que é só leitura.

**Antes de todo `npm run db:push:prod` desta seção, uma conferência de leitura.** Várias trilhas commitam migrations no mesmo `staging`, e o `push` empurra tudo o que estiver pendente, inclusive migration de outra trilha, fora da vez dela:

```
npx supabase migration list --linked
```

**Só siga se as pendentes forem exatamente as que o passo a passo do dia lista pelo nome. Se houver outra, pare e avise.**

**Comandos com `sudo` na forja usam `ssh -t`:** sem terminal, o `sudo` falha se pedir senha. **NÃO VERIFICADO** se ele pede (conferência CP17).

### 16.1 M0: medidas (Mac)

As consultas CP1 a CP6 da seção 7.1, uma por linha, com a saída indo para `.superpowers/sdd/manutencao-nas/saidas/`. No navegador, o painel do B2: a regra de versões do bucket (CP7), com a captura da tela guardada. No Mac, as conferências CP17 e CP18.

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

Se a tabela continuar com dezenas de MB, a reescrita, pela mesma via. Se for recusada, vale a pergunta 8 da seção 20:

```
vacuum full cron.job_run_details;
```

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

### 16.7 M8 e todo mês: conferir o B2 e ensaiar a restauração (Mac)

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

**Todo mês.** O comando do repositório faz o resto e é o único que grava a atestação. Toda execução deixa a tentativa registrada, mesmo a que falha. **Se ela acusar arquivo ausente ou arquivo diferente, a conferência anterior daquele mês é retirada na hora** e a saída trava até uma execução que dê certo (seção 10.4); chave ausente neste Mac e falha de acesso ao B2 não retiram: rode de novo no Mac que tem a chave. Além do mês pedido, o comando confere o mês já descartado que está há mais tempo sem conferência (seção 10.6):

```
npx tsx scripts/obs-arquivo.ts atestar-b2 --mes 2026-10 --classe serie --por <seu e-mail>
```

**A cada 180 dias por tabela, ou quando uma coluna mudar.** O ensaio de restauração (baixa do B2, decifra, sobe um Postgres 17 descartável em `docker`, carrega, compara, grava o resultado e descarta o banco). Ele recusa mês vazio e diz qual tabela restaurou:

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

Por último, os dois comandos da seção 16.7 rodados **uma vez com o Mac fora da rede de casa** (pelo celular), antes da viagem.

### 16.9 Passo de emergência: banco em modo somente leitura

Só se o banco passar de 500 MB. Os comandos são os documentados pelo Supabase (F38), no SQL Editor do painel, numa sessão só, e ficam no runbook desta fase: abrir a sessão para escrita, tirar o mês que estiver pronto, rodar `vacuum`, e religar a escrita por padrão. **O sinal de limite existe para este passo nunca ser usado.** Ele não é ensaiável (seção 13.5).

### 16.10 Expurgo (Mac)

Quando a fila "Saíram do YouTube" mostrar item com cópia no arquivo, ou cópia antiga de comentários a apagar (seções 11.3 e 14.7). São dois tempos (seção 11.3). O primeiro comando reescreve a unidade, o resumo e o manifesto do mês como versões novas e imprime, um por linha, **só o que copiar** para a forja. O segundo imprime o que apagar no NAS e no B2, e recusa enquanto as versões novas não estiverem recebidas e conferidas no B2. Com um mês fora das telas e o espaço por liberar, nenhum dos dois roda: libere o espaço ou traga o mês de volta antes.

```
npx tsx scripts/obs-arquivo.ts expurgar --item <id>
npx tsx scripts/obs-arquivo.ts expurgar --item <id> --apagar-antigas
```

**Casa desligada.** Não há comando do dono para tirar mês sem a casa: esse caminho saiu do escopo (seção 19.3, J13). O que acontece e o que fazer está na seção 13.6.

## 17. Pedidos ao controlador da A5

**Esta sessão não edita plano de outra trilha.** Os planos da A5 são trabalhados por outra sessão no mesmo `staging`. Cada item abaixo é um pedido, com o texto exato a acrescentar. Os pedidos 5 e 6 são **condição de entrada da etapa M2**: se o controlador recusar ou demorar, a M2 converte as tabelas assim mesmo e esta fase neutraliza o risco do lado dela (dito em cada item).

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
| 13 | E10, MG6, `obs_archive_is_site_admin` | A função que a condição 11 do portão usa não muda de nome nem de regra | "`obs_archive_is_site_admin(p_site, p_by)` é usada pelas funções de saída da fase de manutenção (condição 11 da seção 10.5 daquele spec) e pelo botão. Depois de aplicada, não renomear nem mudar a regra (administrador da organização do site ou de uma organização raiz) sem avisar a fase de manutenção. Se a M6 da manutenção chegar antes da MG6, a manutenção cria a função com esta mesma assinatura e esta mesma regra, com `create or replace`; a MG6 passa a encontrá-la criada e mantém `create or replace`." | Esta fase cria a função na M6 se ela não existir, e o teste que lê as migrations falha se alguma migration desta fase a referenciar sem que alguma a defina (item de aceite 119) |
| 14 | E9 (o "apagar" da fila), E10 (tarefa 11b, `removerCanalArquivado` e `competitor_channel_remove_archived`) e o botão "Remover canal" de hoje (`removeCompetitorChannel`) | Tratar a recusa do invariante do mês destacado | "A fase de manutenção instala gatilhos `before delete` e `before truncate` em `competitor_videos` e `competitor_channels` que recusam com a exceção `mes_destacado_em_transito` (os meses vêm no `detail`) enquanto houver mês com `detached_at` preenchido e `dropped_at` nulo em `obs_archive_months`. Todo caminho que apaga vídeo ou canal: (a) reconhece essa exceção e devolve à tela o estado 'remoção bloqueada', com o mês, em vez de erro genérico. A mensagem da exceção é exatamente `mes_destacado_em_transito`, com `SQLSTATE P0001`, sem o prefixo `E10:`: `codigoE10` e o tipo `Desfecho` da E9 ganham um membro próprio, senão ela cai em `inesperado` e em `erro`. O comando `remover` da E10 imprime a mesma frase; (b) não deixa efeito pela metade: o que grava antes do `delete` (`competitor_removed_items`, `audit_log`, `deleted_at` do lote, `blob_urls_pending`) fica na mesma transação do `delete`, ou é desfeito na recusa; (c) a exportação da E10 continua permitida com mês destacado, só a remoção espera; (d) nenhum teste ou rotina **da A5** desliga os gatilhos (os itens de aceite 126 (c) e 115 (f) da fase de manutenção desligam um, dentro do teste); (e) nenhum caminho que apaga vídeo ou canal abre transação acima de `read committed`: em `repeatable read` o gatilho não enxerga o destaque (medido), e um impasse com um destaque em andamento (`deadlock detected` é `SQLSTATE 40P01`) vira 'tente de novo', sem efeito. Fora do destaque nada muda." | A fase de manutenção faz o tratamento no botão de hoje (M6) e, na E9 e na E10, a recusa chega como erro genérico: nada é apagado, mas a tela não diz por quê |
