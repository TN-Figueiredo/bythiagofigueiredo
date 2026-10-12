# Observatório, fase A5 (spec v2.2), parte 06: ciclo de vida do dado, volume e cota

> Parte do spec da A5 v2.2, dividido em 12/10/2026 só movendo texto (nenhuma frase mudou; a numeração de seções, etapas, migrations, perguntas e itens de aceite é a do original). Índice, cabeçalho "O que mudou" e tabela "onde está cada seção": [`../2026-10-12-observatorio-a5-concorrentes-design.md`](../2026-10-12-observatorio-a5-concorrentes-design.md).

## 9. Ciclo de vida do dado, volume e cota (etapa E10)

### 9.1 Quanto pesa um canal concorrente por ano

> **Emenda v2.1:** os comentários de destaque (E14) somam cerca de 1,3 MB por canal por ano e o ritmo por hora (E15), cerca de 0,85; o total passa de ≈ 5,8 para ≈ 8,0. Linhas refeitas em 9.5.

Médias medidas nos 15 canais: 93 vídeos guardados, 98 novos por ano, 61% Shorts; 166 B por linha de série com índices. O dono considera razoável a ordem de 6 MB por canal por ano (12/10).

| Parcela | Linhas | MB no 1º ano | Vai para o arquivo? |
|---|---|---|---|
| Série diária (50 vídeos × 365; igual a hoje) | 18.250 | 3,0 | **sim**, pela idade da linha |
| Série semanal (catálogo guardado, média de 97 vídeos × 52) | 5.000 | 0,8 (**e cresce 0,8 a cada ano**: o catálogo guardado ganha 98 vídeos por ano, todos lidos toda semana) | **sim** |
| Primeiras horas (98 vídeos × 12 leituras) | 1.200 | 0,1 | **sim** |
| `competitor_raw` (93 existentes + 98 novos + ~80 mudanças, ~3 kB) | 270 | 0,8 | só as versões que deixaram de ser a corrente |
| Versões de título, miniatura e descrição; linhas de vídeo; canal por dia | ~1.100 | 0,7 | **não** |
| Histórico de campo; marcas de idade 1, 7 e 30 (MG4) | ~1.200 | 0,2 | **não** |
| Playlists (E3) | ~500 | 0,15 | **não** |
| **Total** | | **≈ 5,8** | série: 3,9 (67%); o resto: 1,9 |

### 9.2 Ciclo de vida do dado

**Decisão do dono (12/10).** O banco está no plano gratuito (500 MB). **Não compactar.** O dado antigo sai do banco online para um banco no NAS da casa dele (ligado o tempo todo, como a forja), e o site consulta o NAS só sob demanda, por um botão do tipo "Ver antigo". **Sempre exportar antes de apagar do banco online.** O banco no NAS "não é algo para fazermos agora, mas para estarmos alinhados nos próximos passos". Sobre o ritmo: "talvez de 6 em 6 meses a gente mande para o NAS, e a consulta fica mais para trás mesmo"; e ele pretende apagar canais que deixarem de interessar. **A fase de manutenção de dados**, com NAS e forja (instalar o banco no NAS, carregar os exports, arquivar por idade, "Ver antigo"), é spec próprio, e ele pretende fazê-la na semana que vem. Nesta fase ficam as regras, o comando de export com conferência e o sinal de limite.

**A fronteira entre "recente" (fica online) e "antigo" (vai para o arquivo) é um parâmetro**, `RULES.archiveCutMonths`, com envio em **lotes semestrais** (janeiro e julho).

- **Padrão proposto: 12 meses online** [DONO, pergunta 2]. Motivo: o carregador das telas já tem teto de 365 dias (fato 7), então com 12 meses nenhuma tela de hoje perde dado; com 6 meses, toda tela que mostra "último ano" passaria a depender do "Ver antigo". O ganho de espaço entre 6 e 12 meses é pequeno (9.3).
- **Com lote semestral, o banco guarda entre o corte e o corte mais 6 meses** (com corte de 12: de 12 a 18 meses de série). Um lote leva os meses de calendário inteiros cuja última linha é mais velha que o corte.
- **O que vai para o arquivo, pela idade da linha:** `competitor_video_daily` (diária e semanal), `competitor_video_early`, as versões não correntes de `competitor_raw`, as leituras antigas de `yt_own_video_retention` (a mais recente de cada vídeo e janela fica) e o bruto dos relatórios em lote do canal próprio (`yt_reporting_report_blobs`, que hoje é **apagado sem export** 180 dias depois do download, a partir de abril de 2027: passa a valer a regra de exportar antes).
- **O que nunca sai do online, por ser pequeno e necessário às telas:** as linhas de vídeo e de canal; as versões de título, miniatura e descrição; o histórico de campo; **as marcas de views nas idades 1, 7 e 30** (`competitor_video_marks`, seção 5); o canal por dia (`competitor_channel_snapshots`: 365 linhas por canal por ano, base de M3(a) e M8); a versão corrente do `raw`; playlists; as decisões da fila de 4.5; o registro dos lotes (abaixo); e todo o canal próprio depois da dieta (`yt_own_video_daily` com menos de 1 MB, alcance, cobertura).
- **Canal sem publicar há 12 meses:** o sistema **sugere** arquivar o canal inteiro (um item na mesma aba da fila de 4.5, seção "Sugestões": nome, última publicação, quanto ocupa). Nada acontece sem o dono confirmar.
- **"Apagar um canal que não interessa mais" passa pela mesma regra:** exportar o canal inteiro (todas as tabelas dele e as miniaturas do Blob), conferir, o dono confirma que o arquivo está no NAS, só então o canal é removido pelo fluxo que já existe. O diálogo de remover canal ganha esse passo e não deixa pular (a exceção é a resposta "apagar" de 4.5, cujo propósito é não guardar).

**O export.**

- **Formato: CSV com cabeçalho, comprimido com gzip, mais um manifesto em JSON por lote.** Por quê: é aberto, legível em qualquer máquina sem instalar nada, e volta para um Postgres (o do NAS, ou o online, numa emergência) com um `\copy` por arquivo; `jsonb` vai como texto. Parquet é menor e guarda os tipos, mas exige biblioteca nas duas pontas e não entra em Postgres sem ferramenta. `pg_dump` não serve: é por tabela inteira, não por canal e período, e amarra à versão do Postgres. Os tipos que o CSV perde ficam no manifesto.
- **Granularidade: um arquivo por tabela, canal e mês de calendário** (`<lote>/<tabela>/<id do canal>/<AAAA-MM>.csv.gz`), para que um canal ou um mês possa ser recarregado, ou expurgado, sem tocar no resto.
- **Manifesto** (`<lote>/manifesto.json` e `<lote>/manifesto.sha256`): por arquivo, a tabela, o canal, o mês, o **número de linhas**, uma **soma de controle** do conteúdo (a soma de `views`, onde existe), a menor e a maior chave, o **sha256** do arquivo, e a lista de colunas com os tipos; por lote, o DDL das tabelas na data e a versão do script.
- **Onde o arquivo fica até ir ao NAS:** numa pasta local do dono, fora do repositório (`~/Workspace/arquivo-observatorio/<lote>/`). Não vai para o Vercel Blob (URL pública) nem para o banco.
- **Quatro comandos, em ordem; cada um recusa rodar se o anterior não fechou.**

| # | Comando | O que faz | Quem roda |
|---|---|---|---|
| 1 | `exportar` | lê do banco online (só `SELECT`), escreve os arquivos e o manifesto, registra o lote como `exportado` | o agente ou o dono |
| 2 | `conferir` | relê os arquivos do disco: conta as linhas, refaz o sha256, e compara linhas e soma de controle com o banco online para o mesmo filtro. Qualquer diferença: para, não marca nada | o agente ou o dono |
| 3 | cópia ao NAS, `sha256sum -c manifesto.sha256` **no NAS**, e `confirmar-nas <lote>` | o dono copia, confere no destino e registra a confirmação (`nas_confirmed_at`, quem) | **só o dono** (o agente prepara os comandos, um por linha) |
| 4 | `apagar <lote>` (**lote por idade: fase de manutenção**; nesta fase o passo 4 é só a remoção de um canal inteiro, pelo fluxo que já existe, liberada pelo lote confirmado) | chama `obs_archive_delete(p_batch)`: recusa se não houver confirmação do NAS; **dentro da transação** reconta as linhas e a soma de controle e aborta se diferirem do manifesto; apaga; grava `deleted_at` e uma linha em `audit_log` | **só o dono** |

- **Regra dura:** nada é apagado do online antes de o dono confirmar que o arquivo está no NAS. Não há apagamento por cron, por prazo, nem "automático depois de N dias".
- **O espaço:** depois de apagar, o banco **para de crescer** (o Postgres reaproveita o espaço); o número de `pg_database_size` só cai com `vacuum full`, que é comando do dono e só se for preciso.
- **Expurgo no arquivo** (para a resposta "apagar" de 4.5): o script gera os comandos que reescrevem os arquivos do canal sem as linhas do vídeo e refazem o manifesto; o dono os roda no NAS.

**O registro dos lotes fica online** (é ele que diz à tela "arquivado", e não "não medido", e que dirá ao "Ver antigo" o que existe):

```sql
create table if not exists public.obs_archive_batches (              -- migration MG6
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  batch text not null,                      -- ex.: '2028-S1'
  table_name text not null,
  channel_ref text not null,                -- id do canal (texto: sobrevive à remoção do canal)
  channel_label text,                       -- nome do canal na data
  period_start date not null,
  period_end date not null,
  row_count bigint not null,
  control_sum numeric,                      -- nulo onde a tabela não tem coluna somável
  file_sha256 text not null,
  exported_at timestamptz not null,
  verified_at timestamptz,                  -- passo 2
  nas_confirmed_at timestamptz,             -- passo 3
  nas_confirmed_by uuid,
  deleted_at timestamptz,                   -- passo 4
  unique (site_id, batch, table_name, channel_ref, period_start)
);
alter table public.obs_archive_batches enable row level security;
drop policy if exists "obs_archive_batches_select" on public.obs_archive_batches;
create policy "obs_archive_batches_select" on public.obs_archive_batches
  for select using (public.can_edit_site(site_id));
```

A mesma migration troca `yt_reporting_blobs_purge` para só apagar bruto que esteja num lote com `nas_confirmed_at`.

**O sinal de "banco chegando ao limite".** Uma linha por dia em `obs_db_size_daily (day date primary key, db_bytes bigint, competitor_bytes bigint, own_bytes bigint)`, gravada pelo cron diário que já existe, por uma função `obs_db_size()` (security definer, `execute` só para `service_role`). A projeção é a reta dos últimos 28 dias. **Amarelo** a partir de 350 MB (70%); **vermelho** a partir de 425 MB (85%) **ou** quando a projeção chega a 500 MB em menos de 90 dias. Aparece no cabeçalho do Observatório para quem edita o site ("banco: 216 de 500 MB; no ritmo dos últimos 28 dias, chega ao limite em jan/2030") e no retorno do cron. Com menos de 14 dias de registro a projeção é "não medida", e sem a linha do dia o sinal é "sem leitura hoje": nunca verde por falta.

**O que é desta fase e o que é da fase de manutenção.**

| Desta fase (E10) | Fase de manutenção (spec próprio, semana que vem), só descrita aqui |
|---|---|
| as regras acima, escritas em `rules.ts` e no runbook | o **banco no NAS** (um Postgres no TrueNAS) |
| os comandos `exportar`, `conferir` e `confirmar-nas`, com a tabela de lotes (MG6); a remoção de canal liberada por lote confirmado; a trava que impede apagar bruto de relatório sem export | a **carga dos exports** nele (um `\copy` por arquivo, conferido pelo manifesto) |
| o sinal de limite | **arquivar por idade de verdade** (`apagar <lote>` e a função `obs_archive_delete`); a **leitura sob demanda pelo site**, o botão "Ver antigo", e o estado "arquivado" nas telas |
| o passo "exportar antes" no diálogo de remover canal, e a sugestão de arquivar canal parado | o **banco no NAS** já citado, com a forja como ponte, se a opção A for a escolhida |

Consequência: nesta fase o export é usado para **remover canais** com segurança e fica pronto, ensaiado, para o primeiro lote por idade, que é da fase de manutenção (com corte de 12 meses e série desde 03/10/2026 não há linha a arquivar antes de janeiro de 2028). **Condição para o primeiro lote por idade rodar:** as telas já saberem dizer "arquivado" (motivo novo de 6.1.5). Sem isso, um mês apagado apareceria como buraco, que é o erro que a regra "falha em verde" proíbe. Liberar espaço pede só os comandos e uma pasta no NAS; o banco no NAS só é necessário para o "Ver antigo".

**Como o site, que roda na nuvem, alcança o NAS (fase de manutenção; opções para o dono, sem decidir por ele).**

| Opção | Como | A favor | Contra |
|---|---|---|---|
| **A. A casa puxa** (o padrão da forja) | o botão grava um pedido numa fila do site ("canal X, de mês a mês"); um trabalhador em casa (na forja, que já tem cron, chave e vigilância e alcança o NAS pela rede interna) faz o claim, consulta o banco do NAS e devolve o resultado ao site, que o guarda com validade curta e teto de tamanho | nenhuma porta de casa aberta para a internet; mesmo padrão, mesma chave e mesma vigilância já operados; casa desligada vira "o arquivo não respondeu", sem erro | não é imediato (espera o próximo ciclo: segundos a poucos minutos, conforme o cron); o resultado ocupa o banco online enquanto vale; precisa de trabalhador e trava **separados** da fila de inteligência (uma tarefa de 20 minutos do modelo não pode segurar o "Ver antigo") |
| **B. O site entra em casa pelo Cloudflare** | uma API só de leitura no NAS, publicada como `studio.*` já é (túnel e Cloudflare Access), e o site chama com um token de serviço | resposta em segundos; nada volta para o banco online | passa a existir uma entrada da internet para dentro de casa (protegida, mas existe); um segredo novo no Vercel; um serviço a mais para manter no TrueNAS; depende do túnel no ar |
| **C. O navegador do dono fala com o NAS** | a tela "Ver antigo" busca direto em `arquivo.*`, atrás do Cloudflare Access, com o login do dono; o site na nuvem nunca toca o NAS | nenhum segredo na nuvem; o dado antigo nem passa pelo Vercel | só funciona para quem tem o login do Access; as contas do motor rodam hoje no servidor e teriam de rodar também no navegador; duas origens de dado na mesma tela |
| **D. Sem leitura pelo site** | abrir os arquivos no computador (DuckDB lê CSV comprimido direto) | zero infraestrutura | não é "no site" |

**Recomendação: A.** É o desenho que já funciona e já é vigiado; "Ver antigo" é raro e pedido de propósito, então esperar um ciclo é aceitável; e não abre nada para dentro de casa. B é a alternativa se a espera incomodar. A escolha é a pergunta 8 e não trava nada desta fase.

**Regra de processo.** Escrita no NAS e na forja é do dono, sem exceção: nenhum agente roda `ssh`, `scp`, `rsync` ou qualquer comando que escreva lá. O agente **prepara** os comandos, curtos, um por linha, e o dono cola. Apagar no banco online (passo 4) também é comando do dono.

### 9.3 Tamanho do banco: sem arquivo, com corte de 12 meses e com corte de 6

> **Emenda v2.1:** as duas tabelas abaixo são as da v2, **sem** os comentários (E14) e **sem** o ritmo por hora (E15). Com os dois a folga sem arquivo cai de 4 a 8 meses (15 canais: mês 30; 20: mês 24; 30: mês 17; 40: mês 13), e com corte de 12 meses os 15 canais de hoje deixam de caber em cinco anos. Tabelas refeitas em 9.5.

Base: 179 MB hoje; menos 70 MB da dieta; mais cerca de 7 MB, uma vez, da retroação do canal próprio (7.3); o resto do site cresce cerca de 22 MB por ano (20 do site, mais a retenção e as tabelas do canal próprio no ritmo de views de hoje). Cada canal concorrente: 5,8 MB no primeiro ano (9.1).

**Achado que corrige a expectativa: o arquivo estabiliza a série, não o banco inteiro.** A série diária fica em patamar (3,0 MB por canal com 12 meses online). Duas coisas continuam crescendo: o que nunca sai (cerca de 1,4 MB por canal por ano) e a série semanal, que é lida para um catálogo cada vez maior (mais 0,8 MB por canal a cada ano). Depois do primeiro ano, cada canal cresce cerca de **2,2 MB por ano com arquivo**, contra 6,6 e subindo sem ele. O banco passa a crescer três vezes mais devagar; não para.

**Banco inteiro, no pico (logo antes do lote semestral), em MB:**

| Canais | Mês 12 (igual nos três) | Mês 36: sem arquivo / corte 12 / corte 6 | Mês 60: sem arquivo / corte 12 / corte 6 |
|---|---|---|---|
| 15 (hoje) | ≈ 225 | 480 / 370 / 335 | 785 / 495 / 450 |
| 20 | ≈ 255 | 580 / 435 / 390 | 970 / 585 / 520 |
| 75 | ≈ 575 | 1.670 / 1.120 / 950 | 3.000 / 1.560 / 1.325 |
| 200 | ≈ 1.300 | 4.145 / 2.685 / 2.225 | 7.630 / 3.780 / 3.150 |

**Quando cada cenário cruza 500 MB** (mês contado de outubro de 2026; já com a dieta e as tabelas novas do canal próprio):

| Canais | **Sem arquivo** (informação: até quando o arquivo teria de existir) | Com corte de 12 meses | Com corte de 6 meses |
|---|---|---|---|
| 15 (hoje) | **mês 38** (dez/2029) | ≈ mês 61 (fim de 2031) | ≈ mês 71 (2032) |
| 20 | **mês 30** (abr/2029) | ≈ mês 46 (meados de 2030) | ≈ mês 56 (2031) |
| 30 | **mês 22** (ago/2028) | ≈ mês 29 | ≈ mês 37 |
| 40 | **mês 17** (mar/2028) | ≈ mês 18 | ≈ mês 28 |
| 75 | mês 10 (ago/2027) | mês 10: cruza **antes** do primeiro lote | ≈ mês 14 |
| 200 | mês 4 (fev/2027) | mês 4 | mês 4 |

Como ler:

1. **A folga sem arquivo nenhum é de 30 a 38 meses com 15 a 20 canais, e de 17 a 22 com 30 a 40.** Nenhum cenário realista fica abaixo de 9 meses; só acima de cerca de 80 canais. Como o dono pretende fazer a fase de manutenção na semana que vem, este número é informação e **não manda na ordem das etapas**; o sinal de limite (item 80) é o que avisa se a realidade fugir da conta. Duas coisas encurtam a conta: **sem a dieta** cada linha perde de 2 a 6 meses (70 MB); e se o canal próprio crescer até o modelo do inventário (cerca de 19 MB por canal por ano em 7.3, em vez de 1), o cenário de 40 canais cai para cerca de 15 meses e o de 20, para 25.
2. **A idade de corte muda pouco:** entre 6 e 12 meses a diferença é de cerca de 2,3 MB por canal, uns 35 MB com 15 canais. O que decide o tamanho é **o número de canais**, e por isso apagar os que deixaram de interessar (com export antes) é a alavanca que mais rende: cada canal removido devolve tudo o que ele ocupava.
3. **75 canais não cabem no plano gratuito por mais de um ano, com ou sem arquivo.** Cabem, no pico, cerca de **25 canais por três anos e 15 por cinco** com corte de 12 meses (31 e 18 com corte de 6). O dono espera demorar a chegar a 75; quando o número passar de 25 a 30, o sinal de 9.2 mostra a data e a escolha volta a ser dele: plano pago, corte menor, ou menos canais.
4. **Saída de emergência, se a fase de manutenção atrasar e o sinal ficar vermelho:** parar de acrescentar canais (o "teto de cerca de 55" da v1 é o número que ainda cabe no primeiro ano sem arquivo nenhum; deixa de ser padrão) e remover canais com export, que já funciona nesta fase. Outra folga possível, que **não** é compactação mas reduz a coleta: ler semanalmente só os vídeos de até 3 anos, o que estanca o crescimento da série semanal; fica registrada, não proposta.

São estimativas: o canal mediano publica 14 vídeos em 90 dias e o maior, 152; a soma depende de quais canais entrarem. Buscar o catálogo inteiro dos canais (pergunta 7) quadruplica a parcela semanal, que é justamente a que cresce.

### 9.4 Cota

> **Emenda v2.1:** a E14 soma cerca de 1,35 unidade por canal por dia e a E15, de 48 a 384 unidades por dia no total (≈ 310, 395, 1.445 e 3.855 nos quatro cenários). Tabela refeita em 9.5.

| Canais | Cota por dia (de 10.000) |
|---|---|
| 15 (hoje) | ≈ 240 |
| 20 | ≈ 320 |
| 75 | ≈ 1.200 |
| 200 | ≈ 3.200 |

A cota não é o limite em nenhum cenário; ela é compartilhada com o A/B Lab e o envio de vídeos do canal próprio (trocar miniatura ou título custa 50 unidades por chamada) e com a busca de canais (100 por busca). A retenção do canal próprio usa a cota da Analytics API, que é outra.

### 9.5 Emenda v2.1: o que os comentários (E14) e o ritmo por hora (E15) mudam no volume, no tamanho do banco e na cota

Só as linhas afetadas. **Onde 9.1, 9.3 e 9.4 divergirem daqui, vale esta seção.** Tudo abaixo é estimativa sobre suposições escritas: nenhum comentário e nenhuma leitura horária existem ainda. Os itens de aceite 122 e 139 mandam medir e corrigir esta seção.

**Suposições da E14.** 98 vídeos novos por canal por ano (9.1), três retratos cada; por vídeo, cerca de 20 comentários distintos ao longo dos três marcos (12 por marco, com troca entre um e outro) mais cerca de 4 respostas do criador; texto médio de 300 B; linha de comentário com índices de cerca de 580 B; linha de leitura por marco de cerca de 110 B; preenchimento médio de 70% (Shorts e canais pequenos têm menos de 12 comentários). As colunas de identidade do autor só existem nos primeiros 28 dias de cada linha e não pesam (menos de 0,02 MB por canal em regime).

**Suposições da E15.** Leitura de hora em hora; curva de 72 horas para os 98 vídeos novos (72 linhas de cerca de 105 B cada); quatro linhas de mapa por canal e mês, de cerca de 5 kB cada depois da compressão dos vetores (7 kB sem ela); leituras cruas e registro de dias somados em regime, sem crescer.

**9.1, linhas novas e total:**

| Parcela | Linhas por canal por ano | MB no 1º ano | Vai para o arquivo? |
|---|---|---|---|
| E14: comentários (`competitor_video_comments`, cerca de 17 por vídeo já com o preenchimento de 70%) | ≈ 1.650 | ≈ 0,95 | **sim**, pela idade (todo comentário é lido nos primeiros 37 dias do vídeo); **sem** as colunas de identidade |
| E14: leituras por marco (`competitor_video_comment_marks`) | ≈ 2.500 | ≈ 0,3 | **sim** |
| E14: retratos (`competitor_video_comment_snaps`) | ≈ 300 | ≈ 0,03 | **não** |
| **Soma da E14** | | **≈ 1,3** (faixa plausível: 0,8 a 1,8) | |
| E15: curva das primeiras 72 horas, hora a hora (**substitui** a linha "Primeiras horas" de 9.1: eram 1.200 linhas e 0,1 MB) | ≈ 7.060 | ≈ 0,75 (**+0,6**) | **sim** |
| E15: mapa de horas (`competitor_channel_hour_map`) | 48 | ≈ 0,25 | **não** (pequeno, e é o que a tela lê) |
| E15: leituras cruas de passagem e registro de dias somados | em regime: ≈ 500 | ≈ 0,05, **sem crescer** | não: são apagadas |
| **Soma da E15 (o que ela acrescenta)** | | **≈ 0,85** | |
| **Total por canal no 1º ano** (era ≈ 5,8) | | **≈ 8,0** (7,1 só com a E14) | série: 4,5 (57%, já com a curva horária); comentários: 1,3; o resto: 2,2 |

Para comparar, o que **não** foi proposto na E15: uma linha por vídeo e por hora para os 50 acompanhados custaria cerca de **46 MB por canal por ano**; só para os vídeos de até 14 dias, cerca de **3,5 MB** (4.7.3).

Nenhuma das duas parcelas acelera: são sempre os vídeos novos do ano. Sem arquivo, o canal passa a crescer 8,0 MB no primeiro ano, 8,8 no segundo, 9,6 no terceiro (a subida é a da série semanal, 9.3). Com arquivo, comentários e curva horária ficam num patamar (juntos, 1,9 a 2,9 MB por canal, corte de 6 e de 12 meses, no pico) e só o mapa segue crescendo, 0,25 MB por canal por ano: **o que nunca sai do online passa de cerca de 1,4 para cerca de 1,7 MB por canal por ano**, e o crescimento com arquivo, de 2,2 para cerca de 2,5. A retroação de comentários (pergunta 12), se for "sim", soma cerca de 0,6 MB por canal, uma vez.

**9.3, as duas tabelas refeitas** (mesmas bases: 179 MB hoje, menos 70 da dieta, mais 7 da retroação do canal próprio, mais 22 por ano do resto do site).

Banco inteiro, no pico, em MB:

| Canais | Mês 12 (igual nos três): v2 → com E14 → **com E14 e E15** | Mês 36, com E14 e E15: sem arquivo / corte 12 / corte 6 | Mês 60, com E14 e E15: sem arquivo / corte 12 / corte 6 |
|---|---|---|---|
| 15 (hoje) | 225 → 245 → **≈ 257** | 576 / 425 / 375 (v2: 480 / 370 / 335) | 942 / 557 / 498 (v2: 785 / 495 / 450) |
| 20 | 255 → 280 → **≈ 297** | 707 / 508 / 442 (v2: 580 / 435 / 390) | 1.181 / 668 / 582 (v2: 970 / 585 / 520) |
| 75 | 575 → 670 → **≈ 734** | 2.151 / 1.389 / 1.151 (v2: 1.670 / 1.120 / 950) | 3.807 / 1.866 / 1.564 (v2: 3.000 / 1.560 / 1.325) |
| 200 | 1.300 → 1.560 → **≈ 1.728** | 5.432 / 3.405 / 2.755 (v2: 4.145 / 2.685 / 2.225) | 9.776 / 4.600 / 3.780 (v2: 7.630 / 3.780 / 3.150) |

Quando cada cenário cruza 500 MB (mês contado de outubro de 2026):

| Canais | **Sem arquivo:** v2 → com E14 → **com E14 e E15** | Com corte de 12 meses: v2 → **com as duas** | Com corte de 6 meses: v2 → **com as duas** |
|---|---|---|---|
| 15 (hoje) | 38 → 33 → **mês 30**, abr/2029 | ≈ 61 → **≈ 49** | ≈ 71 → **≈ 60** |
| 20 | 30 → 26 → **mês 24**, out/2028 | ≈ 46 → **≈ 35** | ≈ 56 → **≈ 46** |
| 30 | 22 → 19 → **mês 17**, mar/2028 | ≈ 29 → **≈ 18** | ≈ 37 → **≈ 28** |
| 40 | 17 → 15 → **mês 13**, nov/2027 | ≈ 18 → **≈ 13: cruza antes do primeiro lote** | ≈ 28 → **≈ 19** |
| 75 | 10 → 8 → **mês 7**, mai/2027 | 10 → **7** | ≈ 14 → **≈ 9** |
| 200 | 4 → 3 → **mês 3** | 4 → **3** | 4 → **3** |

Como ler:

1. **Juntas, as duas etapas tiram de 4 a 8 meses da folga sem arquivo** nos cenários de 15 a 40 canais (15 canais: de 38 para 30 meses; 20: de 30 para 24). A conclusão de 9.3 se mantém com menos margem: nenhum cenário realista fica abaixo de 9 meses (só a partir de cerca de 60 canais, antes 80), e o que decide o tamanho continua sendo o número de canais.
2. **O que muda de verdade é o longo prazo com arquivo.** Com corte de 12 meses cabiam, no pico, cerca de 25 canais por três anos e 15 por cinco; passam a caber cerca de **19 por três anos e 12 por cinco**. **Os 15 canais de hoje deixam de caber em cinco anos com corte de 12 meses** (557 MB no mês 60); cabem, no limite, com corte de 6 (498 MB).
3. **Onde cortar, se for preciso:** a curva hora a hora das 72 horas é a parcela nova mais cara (0,6 MB por canal por ano) e a mais fácil de reduzir (hora a hora só nas primeiras 24 horas e de 2 em 2 depois: cerca de 0,35); o mapa por mês é barato; os comentários dependem do alvo de 12.
4. Se a estimativa de comentários estiver errada para cima (faixa até 1,8 MB), cada linha perde mais um a dois meses.

**9.4, a tabela de cota refeita.**

- **E14, por canal e dia:** 0,81 unidade dos retratos (98 vídeos × 3 marcos ÷ 365) mais 0,54 da conferência por id nos marcos 7 e 30 (supondo uma chamada por vídeo: linha 14 de 4.6.1) = **1,35**.
- **Emenda v2.2, autor de destaque (4.6.2):** uma chamada `channels.list` por vídeo e marco, 1 unidade: **+0,81 por canal e dia** (a opção que a v2.1 estimava em +1,6 saiu mais barata porque a consulta ficou nos 20 mais curtidos, numa chamada só). A parcela da E14 passa de 1,35 para **2,16**. Na coluna "padrão proposto" da tabela abaixo, some: +12 por dia com 15 canais (≈ 322), +16 com 20 (≈ 411), +61 com 75 (≈ 1.506) e +162 com 200 (≈ 4.017). **A conclusão não muda:** a cota continua longe do teto no padrão (60% de folga com 200 canais). Em volume, duas colunas curtas de faixa por comentário e dois números pequenos por retrato: menos de 0,01 MB por canal por ano; a tabela da agenda (4.8.6), menos de 1 MB por ano no total.
- **E15, por execução e não por canal:** `videos.list` custa 1 unidade por chamada, com até 50 vídeos. Os vídeos de até 14 dias de todos os canais vão juntos: com 3,8 por canal, são 57 vídeos com 15 canais (2 chamadas por hora), 76 com 20 (2), 285 com 75 (6) e 760 com 200 (16). Vezes 24 horas: **48, 48, 144 e 384 unidades por dia**.

| Canais | Cota por dia na v2 | Com a E14 | **Com a E14 e a E15 (padrão proposto)** | Com todas as opções ligadas |
|---|---|---|---|---|
| 15 (hoje) | ≈ 240 | ≈ 260 | **≈ 310** | ≈ 820 |
| 20 | ≈ 320 | ≈ 347 | **≈ 395** | ≈ 1.065 |
| 75 | ≈ 1.200 | ≈ 1.300 | **≈ 1.445** | ≈ 3.920 |
| 200 | ≈ 3.200 | ≈ 3.470 | **≈ 3.855** | **≈ 10.440: passa do teto de 10.000** |

O que cada opção soma. Da E14, por canal e dia: respostas completas das conversas escolhidas (pergunta 11), até +2,4; inscritos do autor: **já no padrão desde a v2.2**, por +0,81 (ver o primeiro item desta seção 9.4); reconferência mensal dos comentários guardados por 12 meses (pergunta 13), ≈ +3,0. Da E15: leitura de 30 em 30 minutos (pergunta 17) dobra a parcela dela (96, 96, 288 e 768 por dia; de 2 em 2 horas, a metade); **descobrir vídeo novo de hora em hora (pergunta 19) é a opção cara: 24 unidades por canal por dia** (360, 480, 1.800 e 4.800). A retroação de comentários (pergunta 12) custa 1.389 unidades uma vez. Se a conferência por id exigir uma chamada por comentário (pior caso da linha 14 de 4.6.1), a parcela de 0,54 vira até 6,4 por canal e dia.

**No padrão proposto a cota continua não sendo o limite em nenhum cenário** (61% de folga com 200 canais). Com todas as opções ligadas ela **passa do teto com 200 canais**; até 75 canais, sobra. O que pesa no dia a dia é o número de chamadas HTTP no relógio de cada cron, e por isso os dois passos têm teto próprio (4.6.4 e 4.7.5).

## Itens de aceite deste arquivo (blocos da seção 10 do spec, com a numeração original)

**E10: ciclo de vida**
74. **Ida e volta:** `exportar` e `conferir` sobre a semente; recarregar os arquivos numa tabela vazia reproduz as linhas idênticas (incluindo `jsonb`, nulos, texto com vírgula e quebra de linha); contagem e soma de controle batem com o manifesto.
75. A remoção de um canal recusa sem lote do canal com `nas_confirmed_at`, e recusa se a contagem ou a soma de controle do banco diferem do manifesto; nos dois casos não apaga nada (teste). A exceção é a resposta "apagar" de 4.5.
76. Depois de remover um canal com lote confirmado: as linhas removidas batem com o `row_count` do lote; nenhuma linha de outro canal mudou; uma linha em `audit_log`; o registro do lote continua online.
77. O export recusa arquivar a série de um vídeo com idade 30 fechada e sem marca nem motivo registrado.
78. **Nenhum caminho desta fase apaga série por idade:** não existe comando, cron nem função que o faça (o `apagar <lote>` por idade é da fase de manutenção); teste que avança o relógio 24 meses e afirma que a contagem de `competitor_video_daily` não cai.
79. Canal sem publicar há 12 meses aparece em "Sugestões"; nada é exportado nem apagado sem a confirmação do dono.
80. **Sinal de limite:** no dia do deploy, anotados no ledger o tamanho do banco, o das tabelas de concorrentes e a projeção, comparados com a tabela de 9.3; `obs_db_size_daily` ganha a linha do dia; com menos de 14 dias a projeção diz "não medida"; **apagando** a linha do dia o sinal diz "sem leitura hoje" (nunca verde); os limiares de 350 e 425 MB e o de 90 dias têm teste de borda.
81. `yt_reporting_blobs_purge` não apaga bruto que não esteja num lote com `nas_confirmed_at` (teste).
82. **Ensaio com o dono, de ponta a ponta,** num canal que ele queira remover (ou num canal de teste): os quatro passos, com a cópia ao NAS e o `sha256sum -c` rodado **lá**, os comandos preparados um por linha, e o resultado anotado no runbook.
