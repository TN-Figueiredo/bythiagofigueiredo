# Spec: sugestões a partir do nicho e A/B com o teste nativo como caminho principal

- **Data:** 21/10/2026. **Estado:** r2 (Sonnet), conserta os achados da r1 de Phil e Yannis (66/100 cada); para a re-revisão deles e, nas telas, de Logan e Naksu.
- **Libera (quando Phil e Yannis concordarem):** escrever o plano da fase F0 (coleta). **Não libera:** código, migration, mockup aprovado, deploy.
- **Fontes:** `.superpowers/sdd/ab-lab/sugestoes-de-teste-discussao/` (decisões do dono de 21/10, planos e pareceres, `review-spec-r1-phil.md`, `review-spec-r1-yannis.md`, parecer do Phil sobre o algoritmo, replanejamento do A/B) e `../nativo-vs-nosso-recomendacao/parecer-phil.md`.
- **Legenda:** [V origin/main b04049787] conferido em `origin/main` em 21/10 (um `git grep`/`git show` por item; o checkout local está atrás e **não serve**); [PROD] medido em produção por Phil em 21/10 (SELECT); [P] afirmado por um parecer e não reconferido; [a conferir] dúvida que o plano resolve antes de construir.

## 0. Problema e objetivo

Hoje o sistema só olha para o sucesso dos vídeos do próprio dono e o A/B Lab trata o nosso teste (rotação por tempo) como caminho principal. Dois fatos mudaram isso:

1. **O sucesso do nicho é o sinal mais rico que temos.** O observatório (A5) já coleta quase tudo dos canais de terceiros, mas a leitura é manual (tela de Outliers). A hipótese principal do dono: quando um vídeo grande sobre um destino bomba, o YouTube passa a recomendar outros vídeos daquele destino, inclusive os antigos e menores do dono. A experiência dele (Vietnã, vietnamita: uns 10 canais recomendados depois de assistir a um) indica recomendação por tema **forte**. O parecer do Phil não achou prova oficial: o mecanismo é plausível (Sugeridos e Busca), não provado. **O spec trata o sinal por destino como hipótese principal a medir** (método em §3.6), não como aposta fraca.
2. **O teste nativo do YouTube (Test & Compare) é melhor que o nosso onde ele roda e há volume:** divide o público ao mesmo tempo e mede tempo assistido. O nosso mede por tempo alternado, com viés de dia e de idade [P, parecer nativo × nosso §2].

**Objetivo:** transformar o sucesso do nicho em ação concreta e barata no acervo e na pauta do dono, a partir de uma fonte única de sinais, **gravada uma vez por dia e lida por tabela** pela tela, pelo contador e pelo Cowork; e fazer do teste nativo o caminho principal, com o nosso como exceção que só dá **indício**. A coleta vem antes de tudo, porque dado que a origem expira não volta. Princípio do dono (21/10 12:35): maior performance, menor custo, nada duplicado; cada peça abaixo reaproveita o que existe (§2 e §3.7).

## 1. Decisões

| # | Decisão | Motivo | Fonte |
|---|---|---|---|
| D1 | ASAP: entregar o mais cedo possível; a data dos canais novos (fim de nov a 07/12) é estimativa e não é folga | pedido do dono | decisões 21/10 12:10 |
| D2 | Sinal por destino ("destino esquentou") é a hipótese principal, medida com o nosso dado (§3.6); texto da tela "pode ajudar", nunca "vai ajudar" | experiência do dono pesa; não há prova oficial | decisões 21/10; Phil algoritmo §5.5 |
| D3 | Coleta máxima em **todos** os canais próprios (novos, antigos e parados), a partir da implantação, sem backfill retroativo e sem discriminar por volume | correção do dono 12:15 | decisões 21/10 |
| D4 | A resposta 4 do dono ("remover canais vazios") vale só para a lista de canais acompanhados do nicho, não para canais próprios | correção do dono 12:15 | decisões 21/10 |
| D5 | Já coletamos "tudo deles"; falta cruzamento (contexto, lugar, comentários). Gemma só no campo `lugar` (§2.4 T2). Comentários de terceiros: Cowork/MCP recebem só agregados, nunca autor nem texto inteiro (LGPD, transferência internacional); a forja local pode ler o texto | resposta 2 do dono; Phil M3 | decisões 21/10 |
| D6 | **Uma régua de "bombou"**: item de `outliers(ctx, { maxAge: 30 })` com `!weak` e `phase.id === 'estourando'` (interseção, sobre o mesmo motor da tela). Sem segundo conceito no A/B Lab | paridade Cowork × Claude Code; Yannis I1 | §3.4 |
| D7 | Núcleo puro calcula; eventos gravados numa tabela; **calcula-se só no gravador (1×/dia); a leitura é só a tabela** | Phil I9, Yannis I2 | §3.4 |
| D8 | Ação de terceiro não pré-preenche com a imagem dele; a thumbnail de terceiro é referência de estilo | risco de cópia | Logan §3, Naksu §2, Phil §8 |
| D9 | Regra nativo × nosso: vídeo longo elegível = nativo; Short, kids, 18+, estreia/live agendada e lote = nosso, rotulado "indício por tempo alternado" | parecer nativo × nosso §5 e §8 | Hanna e Yannis replanejar |
| D10 | Portão de volume nas ações de teste de vídeo **publicado há ≥ 7 dias**: sem volume, "Sem volume para teste. Trocar direto?". No lançamento (estreia ou ≤ 48 h) o caminho é nativo sem portão ("o YouTube decide se há volume") | 0 de 33 vídeos com ≥ 100 impressões em 28 dias [PROD, máx. 21]; Yannis I5 | Logan replanejar §2 |
| D11 | Marcador manual "Em teste no Studio" **é sempre aceito** e pausa o nosso sem escrever; a ordem pausar → restaurar → confirmar vale só para habilitar "Abrir no Studio" (§5.2) | escrever durante o nativo cancela o teste; Yannis B2 | spec S6/S7 §6.6 |
| D12 | **Decidido pelo dono (21/10 12:35, sim):** "Original em alta": fica a regra 1280 (T1) e o aviso antes de iniciar; T2 a T18 congelam com gatilho | o nosso vira exceção; o defeito só aparece nele | decisões 21/10; Yannis replanejar §4 |
| D13 | Nome do botão e desenho final saem do mockup com Logan e Naksu | resposta 3 do dono | decisões 21/10 |
| D14 | Notificação do sistema (tipo `niche_signal` em `yt_notifications`) mais lembrete visual, no A/B Lab e em Competidores | resposta 5 do dono | decisões 21/10 |
| D15 | Ordenar pela força do sinal (medida), não por "ganho estimado em views" | Hanna D | hanna-plano §2 |
| D16 | Contador = sugestões abertas e não dispensadas (estado do produto), não "visto" por quem olha | paridade com o Cowork | Hanna E |
| D17 | **Decidido pelo dono (sim):** o bruto dos 10 tipos da Reporting fica sem prazo, comprimido. Fato: **já fica** [PROD] (§2.2 C1); a decisão só vira regra escrita e teste | "coletar mais do que usa" | decisões 21/10 12:35 |
| D18 | **Decidido pelo dono (sim):** thumbnail de terceiro com referência só quando já há tráfego vindo do vídeo dele (§4.2, F4) | o que traz o tráfego do outro é tema e título | decisões 21/10 12:35 |
| D19 | Reaproveitar a Reporting antes de chamar a Analytics; nenhuma coleta que repita dado já gravado | pedido do dono 12:35; Yannis I6, Phil I1 | §2 |

## 2. Coleta (fase F0, antes de tudo) e reconciliação

Regra (D3): vale para **todos** os canais próprios conectados, inclusive os parados, desde o dia da implantação, sem busca retroativa. Canal parado custa quase nada (linha esparsa; o banco rejeita linha com 0 views e 0 minutos, `yt_own_video_traffic_detail_daily_esparsa`, migration `20261013000006`) e dá a linha de base que hoje não existe. Termo de busca e URL externa podem ser dado pessoal: seguem o tratamento existente (`reporting/traffic-source-csv.ts`, hash do detalhe inteiro, corte em 300 caracteres) e a leitura dentro de `can_view_site`.

### 2.1 Fatos que corrigem a r1 [V origin/main b04049787] e [PROD]

- **Jobs da Reporting:** o passo `jobs` só roda para `channels.filter(c => c.sync_enabled)` (`coleta/index.ts:176`). Em produção os 2 canais próprios (tnFigueiredo, 35 vídeos; "Thiago Figueiredo", 0 vídeos) estão `sync_enabled = true`, `collection_status = ok` e **têm os 13 tipos `ativo`** [PROD]. Logo, hoje ninguém fica sem job. **Regra que garante canal parado coberto no futuro:** canal próprio conectado ganha job **independentemente de `sync_enabled`** (job da Reporting não gasta cota), e o critério de saúde `criterioJobsEmErro` acusa "canal próprio conectado sem job ativo de algum dos 13 tipos" (§2.5, decisões da r2 R1).
- **Bruto da Reporting:** `SEM_NORMALIZADOR` ainda diz no comentário "apagado 180 dias depois" (`reporting/types.ts:32`) e `reports-step.ts:592` ainda chama `yt_reporting_blobs_purge`, mas a função no banco **devolve 0** em produção desde a MG13 [PROD, `pg_get_functiondef`]. O bruto já fica sem prazo.
- **Detalhe da origem (`channel_traffic_source_a3`) chega com 16 dias de atraso**, não D+1 a D+3 [PROD: último `day_pt` 05/10; 22 relatórios `listado` de 09 a 19/10]. Causa: `fila-relatorios.ts:35` põe na faixa 1 só `REACH_TYPES`; o resto espera até faltar 7 dias para vencer.
- **`topicDetails` já é pedido** desde 17/10: `VIDEO_PARTS = 'snippet,statistics,contentDetails,liveStreamingDetails,status,topicDetails,paidProductPlacementDetails,localizations,recordingDetails'` (`competitor-sync.ts:28`, commit 6c8f34955). A r1 tratava como pendente.
- **Termos e detalhe de origem não expiram na Analytics** (aceita `startDate`/`endDate` passados). Só expiram na origem os relatórios da Reporting (60 dias corrente, 30 histórico) e os `playlist_*`, que não estão habilitados.

### 2.2 Tabela de reconciliação: o que já coletamos × lacuna × conserto

Nenhuma linha cria segunda coleta do mesmo dado. Cadência da coleta própria: `sync-analytics-metrics` 1×/dia 12:00 UTC (`vercel.json:25`), 300 s.

**Canais próprios (2 conectados)**

| # | Informação útil | Onde já está (tabela · fonte · cadência · retenção) | Lacuna medida | Conserto |
|---|---|---|---|---|
| R1 | Views e minutos por vídeo e dia | `yt_own_video_daily` · Analytics · diário · sem prazo | nenhuma | — |
| R2 | Impressões e CTR por vídeo e dia | `yt_own_video_reach_daily` · Reporting `channel_reach_basic_a1` · faixa 1 · sem prazo | nenhuma (D+4) | — |
| R3 | Impressões por origem e aparelho | `yt_own_video_reach_dim_daily` · `channel_reach_combined_a1` | nenhuma | — |
| R4 | Views por tipo de origem, aparelho/SO, país, inscrito | `yt_own_video_dim_daily` · Analytics `analytics-dimensoes.ts` · diário, janela 10 dias, teto 400 consultas · ligado em 20/10 | nenhuma; o teto estoura com ~100 vídeos com view/dia (R16 abaixo) | — |
| R5 | **Detalhe** da origem (RELATED_VIDEO = id do vídeo que levou ao nosso; YT_SEARCH = termo; URL; canal) | `yt_own_video_traffic_detail_daily` · Reporting `channel_traffic_source_a3` · sem prazo | **16 dias de atraso** [PROD]; YT_SEARCH de pouco volume vem com `detail = ''` | **F0-a:** subir o tipo para a faixa 1 da fila |
| R6 | Termos de busca do canal | soma de R5 (`YT_SEARCH`); `fetchYtSearchTerms` (`analytics-client.ts:275`) só sob demanda | não gravado como visão; **não expira** | **visão SQL sobre R5** (zero job); Analytics semanal só pelo gatilho de r2 R3 |
| R7 | Detalhe da origem pela Analytics (era C2) | duplica R5 e é pior (top 25 por consulta) | — | fora do diário; só na janela de evento (§2.3 C4), ≤ 20 consultas/dia |
| R8 | Retenção de audiência | `yt_own_video_retention` · diário | nenhuma | — |
| R9 | Demografia, local de reprodução, província, legendas, cards, telas finais, compartilhamento, basic, combined, device | bruto gz em `yt_reporting_report_blobs` · sem prazo (purge devolve 0 [PROD]) | **a perda que a C1 da r1 queria evitar não existe**; falta só normalizador | C1 vira "nada a coletar": corrigir o comentário, teste que afirma `purge = 0`; normalizar sob demanda do bruto |
| R10 | Desempenho de **playlist** | nada; 6 tipos `playlist_*_a2` existem, `desativado` | **expira na origem (60 dias)**; sem isso a ação 3 (§4) nunca é medida | habilitar quando a fila baixar (§2.3 C6) |
| R11 | Views públicas por hora do próprio (E15) | `yt_own_public_video_hourly` · 14 dias após publicar | 0 linhas hoje (sem publicação recente); não é defeito | conferir na 1ª publicação do canal novo |
| R12 | Título, miniatura, descrição (versões); metadados diários | `yt_own_video_versions`, `yt_own_video_meta_daily` | canal com 0 vídeos não grava tentativa de `meta` nem `diario` (`diario-step.ts:109` faz `continue`) | gravar `outcome: 'sem_videos'` |
| R13 | Estado do canal | `yt_own_channel_snapshots` | nenhuma | — |
| R14 | Jobs da Reporting por canal | `yt_reporting_jobs`: 13 tipos `ativo` nos 2 canais [PROD] | nenhuma hoje; o filtro `sync_enabled` é risco futuro | regra de §2.1 |
| R15 | **Lugar** dos vídeos próprios | nada | sem campo; busca textual erra em "Vietnã"/"Vietnam" | T2 estendida aos próprios (§2.4) |
| R16 | Capacidade de download | ~57/dia medido [PROD], `MAX_DOWNLOADS = 100`, teto 120 s | com 4 canais × 13 tipos = 52/dia (76 com playlists) estoura | F0-c (§2.3) |

**Terceiros (31 canais, 1.880 vídeos, 166 nos últimos 30 dias, 53 Shorts) [PROD]**

| # | Informação útil | Onde já está | Lacuna | Conserto |
|---|---|---|---|---|
| R17 | Resposta crua de `videos.list` | `competitor_raw` (só quando muda; 4.806 linhas, 21 MB) · sync de 20 min; campos versionados em `field-catalog.ts:5` | `topicDetails` já pedido; se o hash inclui as partes, a 1ª leitura de 17/10 regravou tudo (~8 MB, único) | T1 vira só conferência (§2.4) |
| R18 | Views diárias e marcas de idade | séries diárias + `competitor_video_marks` (migration `20261014000004`; desde 15/10: 129 marcas, D7 em 23 canais, só 1 com ≥ 8) | n ≥ 8 **de marcas** é inviável por semanas | n conta vídeos com `vpd7` no mesmo formato (§3.1) |
| R19 | Curva horária | `competitor_video_hourly` (migration `20261013000002`): 114 vídeos, mediana de 161 h; regra até 14 dias (`horaria/regra.ts`) | nenhuma; fecha o "[a conferir]" antigo e o item "2×/dia" de §10 | — |
| R20 | Título e descrição em texto | `competitor_video_versions.value_text` | nenhuma | a T2 e o casamento leem daqui |
| R21 | Comentários e autores | tabelas da E14 | nenhuma | D5 (só agregados ao Cowork) |
| R22 | Tema | leitura `temas` da forja (`observatorio/load.ts:133`, `OBS_TASK_TYPES`) | tema não é lugar | T2 estende a leitura existente, sem tipo paralelo |

**Resumo:** dos 22 itens, 16 já estão cobertos. Sobram 3 coletas novas de verdade (R10 playlists, R6 como visão, R15 lugar dos próprios), 1 conserto de prioridade (R5), 1 motivo ausente (R12) e 1 campo derivado (lugar). **O que expira na origem e ainda não coletamos é só R10.**

### 2.3 Itens da F0 (próprios)

| # | Item | Cota / custo | Quando |
|---|---|---|---|
| F0-a | Fila: faixa 1 = `REACH_TYPES ∪ {'channel_traffic_source_a3'}` (`fila-relatorios.ts:35`), com teste de ordenação. Esperado: D+2 a D+4. Conferência: 3 dias depois, `max(day_pt)` ≥ hoje − 4 | zero | arquivo da coleta: entra já se a A5 não o tiver aberto; senão após o push de 24/10 |
| F0-b | Jobs para todo canal próprio conectado (não só `sync_enabled`) e `outcome: 'sem_videos'` nos passos `meta` e `diario`; `criterioJobsEmErro` acusa canal sem job. Migration do `check` de `outcome` antes do código, se preciso | zero (Reporting não gasta cota) | após o push de 24/10 (`coleta/index.ts`) |
| F0-c | Capacidade: repetir a execução atual de `relatorios` + `alcance` + `normalizadores` às 00 UTC (mesma trava, só `vercel.json`, zero código novo). Gatilho: antes de conectar o 1º canal novo. Conferência: D+7, `listado` com idade > 7 dias = 0 | 1 cron a mais | antes do canal novo |
| F0-d | C1: corrigir o comentário de `SEM_NORMALIZADOR`; teste afirma `purge = 0` e que o arquivamento no NAS só apaga com `nas_confirmed_at`. Orçamento: ~745 B/bruto × 26/dia ≈ 7 MB/ano (~10 com playlists), alerta no `tamanho_do_banco` existente | zero | com F0-b |
| F0-e | C3: visão SQL de termos sobre `yt_own_video_traffic_detail_daily` | zero job | com a F0 |
| C4 | **Janela de evento = marcador + consulta, não coleta nova.** Para cada evento (§3.1), marcar os vídeos nossos com a mesma chave de lugar e ler -14..-1 e +1..+30 do que R1 e R4 já gravam (a Analytics responde janela passada, então os -14 dias **não** dependem de coleta nova). Leitura fresca de RELATED_VIDEO pela Analytics só nesses vídeos, ≤ 20 consultas/dia, `mapLimit`, gravada em R5 com `source = 'analytics'` (a Reporting sobrescreve quando chega) | < 0,5% da cota | F2 |
| C5 | Canal novo: mesmo pacote no mesmo dia, sem passo manual (já é consequência de F0-b) | — | com F0-b |
| C6 | `playlist_*`: habilitar os 6 tipos em `REPORT_TYPES_ENABLED` **só quando `listado` < 60** (~31/10 na folga atual de ~19–31/dia). Ligar tudo agora soma 310 + 360 = 670 pendentes e estoura os 30 dias de validade do histórico. O histórico de 30 dias que o YouTube gera ao criar o job é brinde, não backfill pedido; perder parte dele não é falha. Conferência: D+7, zero `expirado_sem_baixar` em `playlist%` | +12 downloads/dia | ~31/10 |

### 2.4 Terceiros e lugar

- **T1** (era "pedir `topicDetails`"): **já em produção desde 17/10** [V]. Resta conferir que `topicDetails` aparece em `competitor_raw` e se o hash de mudança cobre o item inteiro (salto único ≤ 8 MB, +6% de 138 MB/500 MB; ou versionar `topicDetails` como campo em `field-catalog.ts`). `topicCategories` são páginas genéricas ("Tourism"): guarda-se por ser grátis; **não entra na T2**.
- **T2** (lugar): a forja grava `lugar` **estruturado** `{pais_iso2, regiao?, local?, slug_local}` (slug = minúsculas, sem acento, de nome canônico) nos outliers do nicho **e nos vídeos próprios** (dezenas/mês, cabe nos 144 claims/dia). Estende a leitura de observatório existente (`OBS_TASK_TYPES`), sem tarefa paralela. O evento agrega em **dois níveis** com chaves distintas, `pais:VN` e `local:vn-phu-quoc`; o casamento com vídeo nosso é igualdade de chave. Teste de tabela: "Phú Quốc", "Phu Quoc", "Ilha de Phu Quoc", "Vietnã" e "Vietnam" caem em `pais:VN` e `local:vn-phu-quoc`.
- **T3** (calibração): taxa de `estourando` por canal e formato **com o mesmo motor** (não `percentile_cont` sobre as marcas), medida em produção; o plano traz a contagem de canais com n ≥ 8 por esse critério.

Fora da coleta: transcrição de terceiros (a API só entrega legenda ao dono), embedding de miniatura, texto de comentário além do E14.

## 3. Sinal

### 3.1 "Destino esquentou" (hipótese principal, D2)

Evento por **lugar** (chave de T2). Dispara quando, para a mesma chave, há ≥ 2 outliers do nicho (régua D6) nos últimos 14 dias **ou** 1 outlier muito acima da mediana do canal dele (parâmetros versionados, valores do Phil depois da T3). **n mínimo** = vídeos `tracked` com `vpd7` **no mesmo formato** (exatamente o que `median7` usa), não marcas. **Piso absoluto** = `vpd7 × 7` do mesmo `ObsVideo` (sugestão: 2.000), com a fonte no motivo. Validade do evento: 30 dias.

Vira sugestão só com cruzamento: existe vídeo **nosso** com a mesma chave de lugar. Sem vídeo nosso, a sugestão é "vídeo novo".

**Não medido:** outlier sem `lugar`, canal sem n mínimo, ou vídeo nosso com base < 3 views/dia gera `nao_medido` com motivo; nunca "frio".

### 3.2 "Vídeo parecido bombou"

Outlier do nicho (D6) casado com um vídeo nosso por filtro determinístico em camadas: mesmo nicho, mesmo formato, sobreposição de tokens de título, tags e início da descrição (pt e en), e lugar quando houver. A forja entra só na F4, para top-K (K ≤ 5) por vídeo nosso, nunca por par. A frase diz "mesmo lugar e mesmo tema" ou "tema parecido, lugar diferente".

### 3.3 "Meu vídeo caiu"

Queda de views/dia ou de CTR do vídeo nosso contra a mediana do próprio canal (ou do nicho, enquanto o canal tem menos de ~10 vídeos com série; declarado no motivo). É **gravado na mesma tabela** pelo gravador diário (depois do `sync-analytics-metrics`), para tela e Cowork lerem a mesma coisa. **Portão de volume (D10):** mostra impressões/dia e dias até o piso; se não chega em 28 dias, a ação é "Trocar direto". Regra exata, parâmetros e piso: Phil no plano.

### 3.4 Fonte única, gravador e leitura

- **Régua (D6):** `outliers(ctx, { maxAge: 30 })` com `!weak` e `phase.id === 'estourando'`. Dívida a pagar junto: `outliers.ts:30` usa `2 *` fixo; trocar por `RULES.outlierMin *` (teste: mudar `RULES.outlierMin` muda a fase). Pré-calcular `Map<canal|fmt, m7>` uma vez e passar `{ m7 }` a `phaseOf` (hoje recalcula por item).
- **Núcleo puro** `lib/youtube/observatorio/oportunidades.ts` (nome provisório): entrada = **projeção estreita** (`OutlierItem[]` já filtrados, vídeos próprios `{id, títulos, descrição normalizada, formato, lugar}`, `agora` injetado), não o `EngineCtx`; quem monta o `EngineCtx` é a borda. Saída = oportunidades com `tipo`, `motivo` (frase com os números, a versão da regra e a fonte do piso), `alvo`, `fonte`, `forca`, ou `motivoVazio` (`sem-historico`, `sem-terceiro-outlier`, `sem-lugar`, `forja-fora`). Nunca `[]` mudo. Teste do núcleo com literais, sem `createObservatory`.
- **Gravador:** **tarefa da agenda do A5** (`agenda/definicoes.ts`, `periodo: 'dia'`, `aPartirDaHoraSP` depois de `marcas_de_idade` e da série diária, `ligaCom: 'OBS_SINAIS_NICHO'`, só `on` liga), com o vermelho da saúde que a agenda já dá. Zero cron novo. Roda 1×/dia: `vpd7` e `median7` mudam uma vez por dia e o motor custa O(C·V·S) (~2,8 M pontos no teto) com cache frio; a 72×/dia seria desperdício. Latência de um `lugar` recém-chegado da forja: até o próximo dia (aceita-se).
- **Tabela** `niche_signals` (nome provisório): `site_id, kind, subject_key, rule_version, evidence jsonb` (ids, nunca imagem), `forca`, `status` (`aberto`, `dispensado`, `feito`, `expirado`), `first_seen_at`, `computed_at`, `expires_at`, `adiado_ate`, `dispensado_em`, motivo. **Índice único parcial `(site_id, kind, subject_key) where status = 'aberto'`**: no máximo um aberto por destino; `rule_version` fora da chave. `subject_key` = chave de lugar (destino) ou id do vídeo de terceiro (parecido). **Retenção sem prazo** (é o conjunto que mede D2; ~0,1 MB/ano, sem dado pessoal). RLS de leitura `can_edit_site(site_id)`, teste que falsifica o GUC.
- **Escrita em lote, idempotente:** (1) `update ... set status = 'expirado' where status = 'aberto' and expires_at <= now()` (mesma execução do gravador, não é job); (2) `insert ... on conflict do nothing returning id`: **só a linha devolvida notifica**; (3) `update ... set evidence, forca, expires_at = greatest(...), rule_version, computed_at where status = 'aberto'`, que nunca toca `status` nem `dispensado_*`. Um evento novo para a mesma chave só nasce depois de `expirado`/`feito`, ou de `dispensado` com 30 dias de carência (o gravador consulta). Proibido `upsert` por item (N+1).
- **Leitura (tela, contador, Cowork):** só a tabela, `where status = 'aberto' and (adiado_ate is null or adiado_ate <= now()) and expires_at > now()` pelo índice parcial, com `count(*)` na mesma consulta; a tela mostra `computed_at` e "desatualizado" quando o gravador falha. `expirado` é derivado também na leitura, então contador velho não sobrevive a gravador quebrado.
- **`getSuggestedVideos`** (`apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts:759`, hoje top 5 por nota e CTR com ≥ 1.000 views, sem paginação do limite de 1.000 linhas) vira leitora da lista. O chip "candidato" mantém a regra atual como `case` do núcleo (≥ 1.000 views, > 14 dias, não testado em 60 dias, nota/CTR).
- **Escrita (dispensar/feito):** server action com `requireSiteAdmin` no topo. Cowork: lê e dispensa pela ferramenta MCP existente `youtube_observatory` com ação nova (paridade D16), seguindo "Pipeline Integrity" (registry + doc) se houver rota.

### 3.5 Notificação

Gerada na transição (linha devolvida pelo `insert`), nunca a cada tique. Reaproveita `yt_notifications` (índice único `(site_id, dedup_key)`) com `dedup_key = 'nicho:' || niche_signals.id` e **tipo novo `niche_signal`**: migration do CHECK (`20260517000003_analytics_intelligence.sql:152`) + união `NotificationType` (`notification-service.ts:1`) + prioridade. A expiração já existe: cron diário `expire-notifications` (`vercel.json:29`, 03:00) [V]. [a conferir: se migrations posteriores mudaram o CHECK; `NotificationType` tem `playlist_created`, ausente do CHECK original.]

### 3.6 Como a hipótese D2 é medida

Para cada evento e cada vídeo nosso com a mesma chave de lugar: média de views/dia em +1..+30 contra -14..-1, só nas origens RELATED_VIDEO, YT_SEARCH e BROWSE (R4). Controle: vídeos nossos **sem** aquele lugar, mesma janela (diferença em diferenças). Prova direta: a parcela de RELATED_VIDEO cujo `detail` = id do outlier (R5). Vídeo com base < 3 views/dia vira `nao_medido: volume`; hoje é o caso dos 35 (as 10 linhas de detalhe somam 14 views [PROD]) e a tela diz isso em vez de "sem efeito".

### 3.7 Reaproveitamento (nada duplicado)

| Peça | Reaproveita | Evita |
|---|---|---|
| Gravador | agenda do A5 | cron novo, 71 recálculos/dia |
| Régua | `outliers()` + `phaseOf` | régua e calibração duplicadas |
| Termos (C3), `RELATED_VIDEO` (C2/F4) | `yt_own_video_traffic_detail_daily` | job e consulta à Analytics |
| Bruto sem prazo (C1) | purge já devolve 0 | normalizadores agora |
| Notificação / expiração | `yt_notifications`, `expire-notifications` | tabela e job novos |
| Marcador | registro `confirmado` da S6 §8.1 em `ab_native_tests` | tabela de marcador |
| Confirmar que o original voltou | `destinoDosCampos` (`ab-restore-acoes.ts:23`) + `ab-gravacao/sonda-step.ts` | leitor novo da página |
| Pausa sem escrever | `settleOnAir(..., 'teste_youtube')` / `pulado_teste_youtube` (`faixa-restauracao-texto.ts`) | caminho paralelo |
| Rota/MCP | ação nova em `youtube_observatory` | ferramenta MCP nova |

## 4. Ações sugeridas (por ordem de custo)

Texto da tela: "pode ajudar". Cada ação é um `case` do núcleo e uma linha de teste, não um módulo.

1. **Título e descrição do vídeo antigo:** conferir se o lugar (chave de T2) está no título e na descrição; se faltar, propor a troca (ou o teste nativo, se houver volume, D10).
2. **Thumbnail com referência (D18):** o painel mostra a do terceiro ao lado da nossa como referência de estilo, com "Use como referência de estilo, não como cópia". Nunca pré-preenche com a imagem dele (D8). Ação plena só quando o detalhe `RELATED_VIDEO` mostrar que já recebemos tráfego daquele vídeo (sim / não / não medido); com "não", a ação recomendada é título ou tema.
3. **Playlist do destino** com os vídeos antigos do lugar (barata, sem risco; ganho é hipótese; medida por R10 depois de C6).
4. **Vídeo novo** sobre o destino, quando não há vídeo nosso ou com 2+ sinais.
5. **Título complementar:** compara com os títulos passados do dono (todos os canais próprios, D3) e evita repetir ângulo; geração pela forja só na F4 (task nova, contexto congelado, validador `forja/numbers.ts`).

## 5. A/B replanejado

### 5.1 Regra nativo × nosso (D9)

| Situação | Caminho |
|---|---|
| Vídeo longo, público, com volume | **nativo** (ficha "Testar no YouTube") |
| Lançamento (estreia ou ≤ 48 h) | nativo, **sem portão de volume**; nunca os dois juntos |
| Short, kids, 18+, estreia/live agendada | nosso (único caminho), "indício por tempo alternado" |
| Lote | nosso, para varrer e priorizar, não para decidir |
| Publicado há ≥ 7 dias, sem volume (hoje os 33 vídeos [PROD]) | nenhum: "Sem volume para teste. Trocar direto?" |

O sistema pré-escolhe o caminho e mostra o motivo; trocar fica atrás de "Prefiro outro caminho". Teste de tabela do portão: idade 0 d / 6 d / 7 d × impressões 0 / acima do piso.

### 5.2 Marcador "Em teste no Studio" e a guarda

- Base: a guarda da S6 fase 2 (`avaliarGuarda`) **não existe no código** [V origin/main: zero ocorrências]. O registrador da S7 fase 1 existe (`lib/youtube/teste-youtube/registro/`), atrás de `AB_NATIVO_REGISTRO` (só `on` liga, `docs/ops/env-vars.md:21`), migration `20261018000006_ab_lab_s7_teste_nativo.sql` aplicada em produção [PROD, `schema_migrations`]; valor da flag na Vercel [a conferir].
- **Dois portões separados (D11).** (a) **O marcador é sempre aceito**; se há teste nosso ativo no vídeo, dispara `settleOnAir(..., motivo: 'teste_youtube')`: pausa sem escrever (`pulado_teste_youtube`), porque escrever durante o nativo cancela o teste. (b) A ordem pausar → restaurar o original → confirmar no YouTube que voltou (`sonda-step.ts`, `variante_vista`; `destinoDosCampos`) vale só para **habilitar "Abrir no Studio"** quando o marcador ainda não existe. Teste: com teste nosso `active` e restore pendente, `confirmarTesteNoStudio` grava o registro `confirmado`, deixa o nosso `paused` com `pulado_teste_youtube` e **zero escrita no YouTube** (mock da Data API sem `update`).
- **Validade:** constante nomeada, **início + 14 dias + 2 de margem**, sem coluna; emenda à S6 §6.5, que hoje avisa aos 30 dias. Marcador vencido vira "sem resposta" e pede o resultado.
- **Janela de corrida (F1a):** se o cron já reivindicou a rotação (`ab_settle_claim`) quando o marcador entra, a escrita sai em até 1 ciclo; a ficha diz "pause o teste antes; o botão só libera depois". A guarda dentro da reivindicação (antes do `claim`) é F1b.

### 5.3 Ficha "Testar no YouTube"

- Até 3 variantes (título e/ou thumbnail), "Copiar título" e "Baixar imagem" por variante, thumbnail sempre em 1280×720 (abaixo disso o Studio reduz tudo a 854×480 [P]); reaproveita a regra 1280 da T1 do plano "original em alta".
- "Abrir no Studio" abre a página do vídeo. No celular: "No computador" e "Lembrar no computador" (o teste nativo é só desktop [P]).
- "Já iniciei" grava o marcador (para título, a S7 também detecta sozinha). Ao abrir qualquer ação do nosso num vídeo com ficha enviada nos últimos 14 dias sem marcador, pergunta "Você iniciou no Studio?".
- **Lembrete no dia 14** (notificação mais selo na linha e na lista): "Venceu a nova", "Ficou igual", "Inconclusivo", "Não vi". **Mapeamento exato em `ab_native_tests`** (valores existentes: `estado ∈ {em_andamento, encerrado, sem_desfecho, descartado}`, `desfecho_estado ∈ {vencedor_provavel, em_andamento, sem_dado}`, `vencedor_fonte ∈ {regra, dono, data_api}`):

| Botão | `estado` | `desfecho_estado` | outros |
|---|---|---|---|
| Venceu a nova | `encerrado` | `vencedor_provavel` | `vencedor_fonte = 'dono'`, `variante_vencedora` (1 a 3), `resposta_dono = 'venceu_nova'`; `vencedor_titulo` quando houver título |
| Ficou igual | `encerrado` | `sem_dado` | `resposta_dono = 'ficou_igual'` |
| Inconclusivo | `encerrado` | `sem_dado` | `resposta_dono = 'inconclusivo'` |
| Não vi / sem resposta | `sem_desfecho` | `sem_dado` | `resposta_dono = 'nao_vi'` ou `'sem_resposta'`; nunca vencedor |

  **Migration aditiva e anulável** (compatível com o código no ar): `resposta_dono text check in ('venceu_nova','ficou_igual','inconclusivo','nao_vi','sem_resposta')` e `variante_vencedora smallint check between 1 and 3`; o CHECK atual de vencedor passa a aceitar `variante_vencedora` no lugar de `vencedor_titulo` (teste só de miniatura). "Inconclusivo" e "Ficou igual" aparecem como "sem dado", não "empate". Testes: um caso por botão grava a linha esperada; "Venceu a nova" só de miniatura passa no CHECK; vencedor sem fonte é recusado; erro de escrita não é engolido (o lembrete não pode ficar para sempre).

### 5.4 Portão de volume (D10)

Vale para os dois caminhos em vídeo com ≥ 7 dias. A ação mostra impressões/dia e dias até o piso; abaixo, "Sem volume para teste. Trocar direto?". Piso e conta: Phil (~1.540 impressões por variante para ganho de 50%, CTR base suposto, parecer nativo × nosso §4).

### 5.5 O nosso só como indício

Placar diz "mais views/dia até agora, indício por tempo alternado"; nunca "vencedor" abaixo do piso. Mesmo nome em todas as telas e no Cowork.

### 5.6 Roteiro (`docs/superpowers/plans/2026-10-14-ab-lab-roteiro-e-horas.md`): o que muda, sem renumerar

- 14 (P4b) e 15 (Migration B): sem mudança de escopo; reconfirmar que nenhuma tabela nova depende da Migration B.
- 16 (medição nova): sai do caminho crítico; vira rótulo "indício" e piso. Gatilho: algum vídeo passar de ~110 impressões/dia.
- 17 ("Candidatos a teste"): absorvido pela lista única de Sugestões (§6).
- 18 (telas do A/B): encolhe ao que o nosso caminho precisa (placar "indício", lote).
- 19 (nativo × nosso): fecha com a regra de §5.1.
- 20 e 21 (detecção, S6 a S9): continuam; a S6 fase 2 (guarda completa) vira **F1b**.

### 5.7 "Original em alta" (D12, decidido)

Fica: T1 (regra única 1280, testes de fronteira 1279/1280) e um aviso antes de iniciar, sem migration nem envio de arquivo. Congela: T2 a T18. Gatilho de descongelar: o dono rodar o primeiro teste nosso em vídeo longo com ≥ 28 dias e perder a original em alta, ou Short/kids recusado de verdade por original baixa. **Risco a sondar antes de qualquer descongelo:** a guarda de início da T11 pode **bloquear Shorts** cuja imagem vertical não tem `maxres` 1280, e Short é o uso principal do nosso; sonda em 2 Shorts reais (Gio ou Phil). Registrar no roteiro como subnúmero de 21.

## 6. Telas (direção; o desenho final e o nome do botão saem do mockup, D13)

- **Lista única "Sugestões (N)"** (nome provisório), aberta por um botão com contador em Competidores e por um bloco no A/B Lab que **substitui** o cartão "Sugeridos para testar" (`ab-lab-dashboard.tsx:346` em `origin/main`). Mesmo estado nos dois: dispensar ou fazer num lugar some no outro.
- Linha: chip de origem com símbolo (meu vídeo caiu / concorrente bombou / destino esquentou / candidato), miniatura e título, frase-motivo com o número, régua contra a mediana, um botão primário que diz o que acontece; dispensar é secundário, com motivo de um toque ("não é para mim", "já tratei", "depois", que volta em 7 dias via `adiado_ate`). Até 5 visíveis, "ver todas (N)".
- Selo de estado por vídeo no A/B Lab: "Em teste no Studio", "Teste nosso rodando", "Resultado do YouTube pronto", "Sem volume"; "não medido" em cinza próprio, nunca 0.
- **Notificação do sistema mais lembrete visual nos dois lugares** (D14); o lembrete do dia 14 vive também na linha do vídeo.
- **Estado vazio do canal novo ou parado:** vazio por tipo, com motivo e régua de progresso; as sugestões de terceiros já aparecem. Carregando: N como "…", nunca 0. Erro: mantém a última lista boa com "desatualizado" (`computed_at`).
- Um componente de cartão para todas as variantes; eyebrow com ≥ 12 px (o atual tem 9 px); só tokens `--cms-*`; cor de carga estrutural em `rgba`/hex, nunca `color-mix()`.

## 7. Fases de entrega (ASAP) e paralelismo com a A5

A A5 empurra em **24/10** e é prioridade do dono (16/10). Arquivos dela: `coleta/index.ts`, `reports-step.ts`, `agenda/definicoes.ts`, `observatorio/outliers.ts`, `fila-relatorios.ts`.

| Fase | Conteúdo | Valor | Aceite | Paralelo com a A5? |
|---|---|---|---|---|
| **F0 Coleta** | F0-a a F0-e, C4, C6, T1 (conferência), T3; tabela de eventos vazia e função de leitura (contrato fixo) | nenhum dado se perde a partir da implantação | Phil roda leitura em produção: para **cada** canal próprio conectado, inclusive os parados e o sem vídeos, jobs `ativo` dos 13 tipos e, no D+3, linha de coleta **ou motivo** (`sem_videos`); `max(day_pt)` do detalhe ≥ hoje − 4; `topicDetails` presente em `competitor_raw`; teste apaga cada flag/variável nova e afirma o padrão | **Agora, em paralelo:** plano da F0, migrations (`npm run db:new`), visão de termos (F0-e), C6 sem código. **Espera o push de 24/10:** F0-a (`fila-relatorios.ts`, se a A5 o tiver aberto), F0-b (`coleta/index.ts`, `diario-step.ts`), F0-d (`reports-step.ts`, `types.ts`) |
| **F1a Ficha e marcador** (sem portão) | ficha "Testar no YouTube", marcador "Já iniciei" sempre aceito + pausa sem escrever (D11), lembrete do dia 14 com 4 botões (§5.3, migration aditiva), portão de volume ≥ 7 dias e rótulo "indício", T1 + aviso (D12), recusa simples no **início** do teste nosso quando há `ab_native_tests` `em_andamento` no vídeo (uma consulta no `start`, sem `avaliarGuarda`) | o lançamento de novembro sai no nativo sem o nosso pisar nele, sem esperar portão | `start` do nosso com registro aberto → recusa com motivo; sem registro → segue; marcador com teste nosso ativo pausa sem escrita; um teste por botão; ficha leva 1280×720 (Gio no Opera); no dia 14 o lembrete aparece | **sim**: mexe em `ab-lab/` e `teste-youtube/`, fora do território da A5 |
| **F1b Guarda completa** | `avaliarGuarda` da S6 fase 2, guarda dentro da reivindicação (M6), portões C-17 e C-17b | o nosso nunca escreve durante o nativo mesmo sem "Já iniciei" | portões da S6 | depende do teste nosso girar (C-17b exige ≥ 3 rotações); **não bloqueia o lançamento**; antes do primeiro teste nosso em vídeo com T&C |
| **F2 Sinal via Cowork** | núcleo puro, tabela, gravador na agenda, "vídeo parecido bombou" e "destino esquentou" (T2 pela forja), ação MCP | o dono pergunta ao Cowork "o que bombou no nicho e eu não tenho?" | Cowork e rota devolvem a mesma lista e o mesmo N; cada linha cita número e versão da regra; teste apaga o histórico e afirma o `motivoVazio`; reexecução não duplica evento nem reabre dispensado; `OBS_SINAIS_NICHO` apagada desliga a tarefa (`catalogo.test.ts`) | **Em paralelo:** núcleo, tabela, migrations (CHECK de `yt_notifications` e `niche_signals` antes do código que grava). **Espera o push de 24/10:** `agenda/definicoes.ts`, `outliers.ts` (`RULES.outlierMin`, `m7`) |
| **F3 Tela única** | lista "Sugestões (N)" nos dois lugares, notificação na transição | decisão em 3 segundos sem abrir o Cowork | mockup aprovado (Logan, Naksu, dono); N igual em Competidores, A/B Lab e Cowork; dispensar num lugar derruba o N no outro; canal vazio mostra motivo e régua | depois do mockup |
| **F4 Depende de dado** | thumbnail com referência condicionada ao `RELATED_VIDEO`; título complementar pela forja (top-K); "meu vídeo caiu" com portão | ações mais caras só com evidência | cartão mostra "já recebo tráfego dele: sim/não/não medido"; título gerado não afirma número fora do contexto congelado | — |

Caminho crítico até o dono sentir valor: F0 → F1a (o dia 14 do 1º vídeo novo cai em dezembro) → F2. **Ordem obrigatória:** migration antes do código que grava; `OBS_SINAIS_NICHO` no Vercel antes do deploy que a lê (desligada por padrão; teste que apaga a variável). Orçamento de builds (≤ 3 pushes/dia/terminal até 27/10): F0 e F1a cabem numa promoção combinada só se revisados até a véspera.

## 8. Riscos, incluindo falhar em verde

| Sinal ou peça | O que acontece quando o dado não existe? | Resposta do desenho |
|---|---|---|
| "Destino esquentou" | outlier sem `lugar` (forja fora ou atrasada) gera zero eventos com cara de "nada esquentou" | `nao_medido` com motivo `sem-lugar`/`forja-fora`; contagem de outliers sem lugar visível |
| "Destino esquentou" | canal com poucos vídeos: razão enorme por mediana minúscula | n mínimo (vídeos com `vpd7` no formato) e piso absoluto; abaixo, `nao_medido` |
| Medida de D2 | canal nosso sem base nos -14 dias ou < 3 views/dia | `nao_medido: volume`/`linha de base ausente`; a tela diz, nunca "sem efeito" |
| "Meu vídeo caiu" | canal novo ou parado sem mediana própria | mediana do nicho, declarada no motivo; sem nenhuma, `sem-historico` |
| Contador | gravador falhou e a tabela ficou velha | `expires_at` filtrado na leitura; tela mostra `computed_at` e "desatualizado"; vermelho da agenda |
| `RELATED_VIDEO` | detalhe abaixo do limiar vem vazio (`detail = ''`) ou chega com atraso | "sem detalhe" ≠ "não recebo tráfego"; três estados sim / não / não medido; fila corrigida (F0-a) |
| Marcador | dono esquece "Já iniciei" num teste só de miniatura | a guarda libera (furo declarado na S6 §6.6); mitigação: "Você iniciou no Studio?"; F1b fecha |
| Resultado do nativo | dono não registra | `sem_desfecho` + `sem_resposta`, nunca vencedor |
| Coleta F0 | canal parado, com `sync_enabled = false` ou sem vídeos, pulado e nenhuma linha gravada: parece "canal sem dado" | jobs para todo próprio conectado; `sem_videos`; aceite exige linha **ou motivo** por canal; `criterioJobsEmErro` acusa canal sem job |
| Fila da Reporting | canal novo triplica a demanda e o corrente vence sem download | F0-c antes do canal novo; conferência `listado` > 7 dias = 0 |
| Playlists | ligar os 6 tipos estoura a fila e perde histórico | só com `listado` < 60 (C6) |
| Bruto da Reporting | comentário do código diz "apagado em 180 dias" | corrigido; teste afirma `purge = 0` |
| Cópia | thumbnail de terceiro está no Blob com URL pública (A5 §13) [P] | referência só dentro de `can_view_site`; evidência guarda id, não a imagem |

## 9. Perguntas abertas ao dono

Nenhuma. As três perguntas da r1 foram respondidas "sim" em 21/10 ~12:35 e viraram D12, D17 e D18.

## 10. Fora de escopo (com gatilho de retomada)

| Item | Gatilho |
|---|---|
| Embedding de miniatura e "parecido" semântico | mais da metade das dispensas em 30 dias for "não é parecido" ou "lugar diferente" |
| Momento de publicar (mapa E15) | canal novo com vídeos suficientes para mapa próprio (n pelo Phil) |
| Push e e-mail de sugestão | o dono disser que perdeu uma sugestão, ou antes da viagem de jan/2027 |
| Integração com API do teste nativo | surgir API pública; aí a leitura troca o marcador manual |
| Busca anônima pela forja (posição do nosso vídeo por termo) | F2 no ar e termos de destino definidos; conferir os termos de uso antes |
| Google Trends | API sair do alpha fechado |
| Termos de busca semanais pela Analytics (era C3) | a visão sobre R5 ficar vazia em mais de X% das semanas por `detail = ''` (X pelo Phil) |
| Original em alta T2 a T18 | gatilho de §5.7 |
| Limpar `yt_own_video_daily_zeros_bkp` (24 MB, 17% do banco) | registrar no BACKLOG com data de descarte |

## 11. A conferir antes do plano

- **Toda referência de código é de `origin/main` (b04049787); o checkout local (`staging` 5e581375b, 231 arquivos atrás em `lib/youtube`) não serve.**
- `AB_NATIVO_REGISTRO=on` na Vercel.
- Se o hash de mudança de `competitor_raw` inclui `topicDetails` (salto único de ~8 MB) e se já aparece no raw.
- Se migrations posteriores mudaram o CHECK de `yt_notifications.type`.
- Retenção da Reporting no Google hoje (60 × 180 dias) e se algum `check` de `outcome` aceita `sem_videos`.
- Contagem de canais com n ≥ 8 pelo critério novo (§3.1) em produção.

## 12. Decisões da r2 (divergências entre Phil e Yannis, e como os achados foram aplicados)

Critério: o menor custo que não abre buraco. Todos os achados da r1 foram aplicados (Phil B1–B4, I1–I9, M1–M6; Yannis B1–B3, I1–I8, M1–M6); abaixo só o que exigiu escolha.

| # | Divergência / ponto | Decisão | Motivo |
|---|---|---|---|
| R1 | Yannis I3: canal sem `sync_enabled` fica sem job. Phil R14: os 2 canais têm 13 jobs `ativo` em produção | **Os dois estão certos.** Fato [PROD]: hoje os 2 têm `sync_enabled = true` e 13 jobs. Código [V]: o filtro `sync_enabled` existe (`coleta/index.ts:176`). Regra: jobs para todo próprio conectado, independentemente da flag, mais o critério de saúde que acusa canal sem job | job da Reporting não gasta cota; a regra fecha o buraco futuro sem mudar o presente |
| R2 | C1: Yannis M5 (tirar tipos da lista do purge) × Phil M1 (purge já devolve 0) | Nada a coletar nem mudar na lista; corrigir comentário + teste `purge = 0` | o dono quer sem prazo e já é assim; mexer na lista seria trabalho para um efeito que não existe |
| R3 | C3: Yannis (visão SQL sobre R5, zero job) × Phil (Analytics 1×/semana com janela) | **Visão SQL sobre R5.** Analytics semanal só pelo gatilho de §10 | custo zero e dado não expira; a r1 de ambos concorda que não há perda por esperar |
| R4 | C2: ambos tiram do diário. Tabela: Phil (mesma tabela com `source = 'analytics'`) | Phil, só na janela de evento, ≤ 20/dia | reaproveita a chave existente; a Reporting sobrescreve |
| R5 | Evento: Yannis (`window_key` = lugar + data, upsert condicional, `adiado_ate`) × Phil (índice único parcial `aberto`, insert + update) | Índice único parcial **e** `adiado_ate`; expirar na mesma execução do gravador + filtro na leitura | sem balde de data, nada para ficar ambíguo; Yannis M3 respeitado (nenhum job de expiração) |
| R6 | Piso absoluto: Yannis (`v.views` do `ObsVideo`) × Phil (marca D7, senão `vpd7 × 7`) | `vpd7 × 7` do mesmo `ObsVideo`, fonte no motivo | uma só fonte; as marcas só cobrem 1 canal com n ≥ 8 |
| R7 | Resultado do nativo: Yannis (`vencedor_miniatura jsonb`, `desfecho_motivo`) × Phil (`resposta_dono`, `variante_vencedora`, `valido_ate`) | Phil nas duas colunas (distingue botões no banco; vale para título e miniatura); validade por **constante** (Yannis), sem `valido_ate` | menos colunas e sem jsonb solto |
| R8 | Quando roda o gravador: Phil (1×/dia e de novo quando chega `lugar`) × Yannis (1×/dia) | 1×/dia | reexecutar o motor por causa de um `lugar` custa mais que esperar até o dia seguinte; ASAP continua atendido porque o evento vale 30 dias |
| R9 | Capacidade: Phil (rota nova 3×/dia ou execução repetida) | repetir a execução atual às 00 UTC (só `vercel.json`) | triplicar com rota nova é código a mais; começa pelo zero-código e mede |
| R10 | F1: Yannis (F1a sem portão + F1b) | adotado | evita travar o lançamento num portão que pode nunca fechar |
| R11 | Timing do `fila-relatorios.ts` (Phil: entra já; Yannis: arquivos da A5 esperam 24/10) | entra já só se a A5 não tiver o arquivo aberto; senão 24/10 | evita conflito de edição com a A5 a 100% |

**Sem conserto nesta rodada:** valor de `AB_NATIVO_REGISTRO` na Vercel; hash de `competitor_raw` e CHECK de `yt_notifications` (viram conferência de §11); piso exato, parâmetros do "meu vídeo caiu" e X de §10 (Phil, no plano); retenção da Reporting no Google; data em que os vídeos passam de ~100/dia (estimativa).
