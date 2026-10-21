# Spec: sugestões a partir do nicho e A/B com o teste nativo como caminho principal

- **Data:** 21/10/2026. **Estado:** r3 (Sonnet), conserta a revisão adversarial da r2 (55/100: B1–B3, I1–I8, M1–M7; decisões em §13); antes, a r2 consertou a r1 de Phil e Yannis (66/100 cada). Para a re-revisão deles e, nas telas, de Logan e Naksu.
- **Libera (quando Phil e Yannis concordarem):** escrever o plano da fase F0 (coleta). **Não libera:** código, migration, mockup aprovado, deploy.
- **Fontes:** `.superpowers/sdd/ab-lab/sugestoes-de-teste-discussao/` (decisões do dono de 21/10, planos e pareceres, `review-spec-r1-phil.md`, `review-spec-r1-yannis.md`, `review-spec-r2-adversarial.md`, parecer do Phil sobre o algoritmo, replanejamento do A/B) e `../nativo-vs-nosso-recomendacao/parecer-phil.md`.
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
| D2 | Sinal por destino ("destino esquentou") é a hipótese principal, medida com o nosso dado (§3.6, fase F2b); texto da tela "pode ajudar", nunca "vai ajudar" | experiência do dono pesa; não há prova oficial | decisões 21/10; Phil algoritmo §5.5 |
| D3 | Coleta máxima em **todos** os canais próprios (novos, antigos e parados), a partir da implantação, sem backfill retroativo e sem discriminar por volume | correção do dono 12:15 | decisões 21/10 |
| D4 | A resposta 4 do dono ("remover canais vazios") vale só para a lista de canais acompanhados do nicho, não para canais próprios | correção do dono 12:15 | decisões 21/10 |
| D5 | Já coletamos "tudo deles"; falta cruzamento (contexto, lugar, comentários). Gemma só no campo `lugar` (§2.4 T2). Comentários de terceiros: Cowork/MCP recebem só agregados, nunca autor nem texto inteiro (LGPD, transferência internacional); a forja local pode ler o texto | resposta 2 do dono; Phil M3 | decisões 21/10 |
| D6 | **Uma régua de "bombou"**: item de `outliers(ctx, { maxAge: 30 })` com `!weak` e `phase.id === 'estourando'` (interseção, sobre o mesmo motor da tela). Sem segundo conceito no A/B Lab | paridade Cowork × Claude Code; Yannis I1 | §3.4 |
| D7 | Núcleo puro calcula; eventos gravados numa tabela; **calcula-se só no gravador (1×/dia); a leitura é só a tabela** | Phil I9, Yannis I2 | §3.4 |
| D8 | Ação de terceiro não pré-preenche com a imagem dele; a thumbnail de terceiro é referência de estilo | risco de cópia | Logan §3, Naksu §2, Phil §8 |
| D9 | Regra nativo × nosso: vídeo longo elegível = nativo; Short, kids, 18+, estreia/live agendada e lote = nosso, rotulado "indício por tempo alternado" | parecer nativo × nosso §5 e §8 | Hanna e Yannis replanejar |
| D10 | Portão de volume nas ações de teste de vídeo **publicado há ≥ 7 dias**: sem volume, "Sem volume para teste. Trocar direto?". No lançamento (estreia ou ≤ 7 dias) o caminho é nativo sem portão ("o YouTube decide se há volume") | 0 de 33 vídeos com ≥ 100 impressões em 28 dias [PROD, máx. 21]; Yannis I5 | Logan replanejar §2 |
| D11 | Marcador manual "Em teste no Studio" **é sempre aceito** e pausa o nosso sem escrever (mudança em `settleOnAir`, §5.2); a ordem pausar → restaurar → confirmar vale só para habilitar "Abrir no Studio" (§5.2) | escrever durante o nativo cancela o teste; Yannis B2 | spec S6/S7 §6.6 |
| D12 | **Decidido pelo dono (21/10 12:35, sim):** "Original em alta": fica a regra 1280 (T1) e o aviso antes de iniciar; T2 a T18 congelam com gatilho | o nosso vira exceção; o defeito só aparece nele | decisões 21/10; Yannis replanejar §4 |
| D13 | Nome do botão e desenho final saem do mockup com Logan e Naksu | resposta 3 do dono | decisões 21/10 |
| D14 | Notificação do sistema (`createNotification`, tabela `notifications`, tipo `youtube.niche_signal`; §3.5) mais lembrete visual, no A/B Lab e em Competidores | resposta 5 do dono | decisões 21/10 |
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
- **Detalhe da origem (`channel_traffic_source_a3`) chega com 16 dias de atraso**, não D+1 a D+3 [PROD: último `day_pt` 05/10; 22 relatórios `listado` de 09 a 19/10]. Causa (corrigida na r3): a faixa 2 de `fila-relatorios.ts:52-60` é ordenada **por vencimento**; 157 relatórios de histórico `listado` dos 9 tipos novos (criados 14 a 15/10, validade de 30 dias) passam na frente dos correntes (60 dias), e `traffic_source` tem 22 correntes esperando desde 11/10 [PROD]. O atraso é transitório (escoa por volta de 31/10, ~31/dia líquidos) e **volta a cada criação de job** (canal novo, C6). `fila-relatorios.ts:35` põe na faixa 1 só `REACH_TYPES`; F0-a continua certa.
- **`topicDetails` já é pedido e já é gravado** (resolvido, M2): 1.754 de 1.911 raws atuais o têm [PROD]; o salto de 8,6 MB já aconteceu em 17/10. Pedido desde 17/10: `VIDEO_PARTS = 'snippet,statistics,contentDetails,liveStreamingDetails,status,topicDetails,paidProductPlacementDetails,localizations,recordingDetails'` (`competitor-sync.ts:28`, commit 6c8f34955). A r1 tratava como pendente.
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
| R5 | **Detalhe** da origem (RELATED_VIDEO = id do vídeo que levou ao nosso; YT_SEARCH = termo; URL; canal) | `yt_own_video_traffic_detail_daily` · Reporting `channel_traffic_source_a3` · sem prazo | **16 dias de atraso** [PROD] (causa: ordem por vencimento, §2.1); YT_SEARCH de pouco volume vem com `detail = ''` | **F0-a:** subir o tipo para a faixa 1 da fila |
| R6 | Termos de busca do canal | soma de R5 (`YT_SEARCH`); `fetchYtSearchTerms` (`analytics-client.ts:275`) só sob demanda | não gravado como visão; **não expira** | **visão SQL sobre R5** (zero job); Analytics semanal só pelo gatilho de r2 R3 |
| R7 | Detalhe da origem pela Analytics (era C2) | duplica R5 e é pior (top 25 por consulta) | — | fora do diário; só na janela de evento (§2.3 C4), ≤ 20 consultas/dia |
| R8 | Retenção de audiência | `yt_own_video_retention` · diário | nenhuma | — |
| R9 | Demografia, local de reprodução, província, legendas, cards, telas finais, compartilhamento, basic, combined, device | bruto gz em `yt_reporting_report_blobs` · sem prazo (purge devolve 0 [PROD]) | **a perda que a C1 da r1 queria evitar não existe**; falta só normalizador | C1 vira "nada a coletar": só corrigir o comentário (o teste `purge = 0` já existe como verificação em `reports-step.ts:595`, M3); normalizar sob demanda do bruto |
| R10 | Desempenho de **playlist** | nada; 6 tipos `playlist_*_a2` existem, `desativado` | **expira na origem (60 dias)**; sem isso a ação 3 (§4) nunca é medida | habilitar quando a fila baixar (§2.3 C6) |
| R11 | Views públicas por hora do próprio (E15) | `yt_own_public_video_hourly` · 14 dias após publicar | 0 linhas hoje (sem publicação recente); não é defeito | conferir na 1ª publicação do canal novo |
| R12 | Título, miniatura, descrição (versões); metadados diários | `yt_own_video_versions`, `yt_own_video_meta_daily` | canal com 0 vídeos não grava tentativa de `meta` nem `diario` (`diario-step.ts:109` faz `continue`) | gravar `outcome: 'sem_videos'` |
| R13 | Estado do canal | `yt_own_channel_snapshots` | nenhuma | — |
| R14 | Jobs da Reporting por canal | `yt_reporting_jobs`: 13 tipos `ativo` nos 2 canais [PROD] | nenhuma hoje; o filtro `sync_enabled` é risco futuro | regra de §2.1 |
| R15 | **Lugar** dos vídeos próprios | nada | sem campo; busca textual erra em "Vietnã"/"Vietnam" | lugar v0 determinístico, tabela `lugares` (§2.4 T2), também nos próprios |
| R16 | Capacidade de download | 40 a 70/dia medido, ~90% `vazio` [PROD]; `MAX_DOWNLOADS = 100`; gargalo real é o 429 por minuto da Reporting (`reports-step.ts:19`) | com 4 canais × 13 tipos = 52/dia (76 com playlists) estoura | F0-c (§2.3) |

**Terceiros (31 canais, 1.880 vídeos, 166 nos últimos 30 dias, 53 Shorts) [PROD]**

| # | Informação útil | Onde já está | Lacuna | Conserto |
|---|---|---|---|---|
| R17 | Resposta crua de `videos.list` | `competitor_raw` (só quando muda; 4.806 linhas, 21 MB) · sync de 20 min; campos versionados em `field-catalog.ts:5` | `topicDetails` já pedido; se o hash inclui as partes, a 1ª leitura de 17/10 regravou tudo (~8 MB, único) | T1 vira só conferência (§2.4) |
| R18 | Views diárias e marcas de idade | séries diárias + `competitor_video_marks` (migration `20261014000004`; desde 15/10: 129 marcas, D7 em 23 canais, só 1 com ≥ 8) | n ≥ 8 **de marcas** é inviável por semanas | n conta vídeos com `vpd7` no mesmo formato (§3.1) |
| R19 | Curva horária | `competitor_video_hourly` (migration `20261013000002`): 114 vídeos, mediana de 161 h; regra até 14 dias (`horaria/regra.ts`) | nenhuma; fecha o "[a conferir]" antigo e o item "2×/dia" de §10 | — |
| R20 | Título e descrição em texto | `competitor_video_versions.value_text` | nenhuma | a T2 e o casamento leem daqui |
| R21 | Comentários e autores | tabelas da E14 | nenhuma | D5 (só agregados ao Cowork) |
| R22 | Tema | leitura `temas` da forja (`observatorio/load.ts:133`, `OBS_TASK_TYPES`); `competitor_readings` tem **0 linhas** e `youtube_intelligence_tasks` só tem `diagnostico` nos últimos 30 dias [PROD] | tema não é lugar; a forja nunca produziu leitura do observatório | fora do caminho crítico: o lugar v0 não depende dela (T2) |

**Resumo:** dos 22 itens, 16 já estão cobertos. Sobram 3 coletas novas de verdade (R10 playlists, R6 como visão, R15 lugar dos próprios), 1 conserto de prioridade (R5), 1 motivo ausente (R12) e 1 campo derivado (lugar). **O que expira na origem e ainda não coletamos é só R10.**

### 2.3 Itens da F0 (próprios)

| # | Item | Cota / custo | Quando |
|---|---|---|---|
| F0-a | Fila: faixa 1 = `REACH_TYPES ∪ {'channel_traffic_source_a3'}` (`fila-relatorios.ts:35`), com teste de ordenação. Esperado: D+2 a D+4. **Conferência por canal (não por `max(day_pt)`, que não depende da coleta num canal de ~0,5 view/dia):** existe `yt_reporting_reports` de `channel_traffic_source_a3` com `status in ('baixado','vazio')` e `end_time >= hoje − 4` | zero | arquivo da coleta: entra já se a A5 não o tiver aberto; senão após a promoção da A5 de 22/10 |
| F0-b | Jobs para todo canal próprio conectado (não só `sync_enabled`) e `outcome: 'sem_videos'` nos passos `meta` e `diario`; `criterioJobsEmErro` acusa canal sem job. "Conectado" = token válido (M6): canal desligado de propósito ou em `reautorizar` não vira vermelho. Migration do `check` de `outcome` antes do código, se preciso | zero (Reporting não gasta cota) | após a promoção da A5 de 22/10 (`coleta/index.ts`) |
| F0-c | Capacidade (I2, **não é só `vercel.json`**): a rota `sync-analytics-metrics` não tem modo parcial, e repetir a entrada dobraria a cota da Analytics e da Data API. Adicionar `?passos=jobs,relatorios,alcance,normalizadores` (lista fechada validada por Zod; teste que manda passo desconhecido e espera recusa) e uma entrada às 00 UTC com esses passos. Gatilho: antes de conectar o 1º canal novo. Conferência: D+7, `listado` com idade > 7 dias = 0 | 1 cron a mais, sem cota extra | antes do canal novo |
| F0-d | C1: corrigir o comentário de `SEM_NORMALIZADOR` (o teste `purge = 0` já existe como verificação, M3); teste de que o arquivamento no NAS só apaga com `nas_confirmed_at`. Orçamento: ~745 B/bruto × 26/dia ≈ 7 MB/ano (~10 com playlists), alerta no `tamanho_do_banco` existente | zero | com F0-b |
| F0-e | C3: visão SQL de termos sobre `yt_own_video_traffic_detail_daily` | zero job | com a F0 |
| C4 | **Janela de evento = marcador + consulta, não coleta nova.** Para cada evento (§3.1), marcar os vídeos nossos com a mesma chave de lugar e ler -14..-1 e +1..+30 do que R1 e R4 já gravam (a Analytics responde janela passada, então a janela pré **não** depende de coleta nova; janelas em §3.6). Leitura fresca de RELATED_VIDEO pela Analytics só nesses vídeos, ≤ 20 consultas/dia, `mapLimit`, gravada em R5 com `source = 'analytics'` (a Reporting sobrescreve quando chega) | < 0,5% da cota | F2b |
| C5 | Canal novo: mesmo pacote no mesmo dia, sem passo manual (já é consequência de F0-b) | — | com F0-b |
| C6 | `playlist_*`: habilitar os 6 tipos em `REPORT_TYPES_ENABLED` **só quando `listado` < 60** (~31/10 na folga atual de ~19–31/dia). Ligar tudo agora soma 310 + 360 = 670 pendentes e estoura os 30 dias de validade do histórico. O histórico de 30 dias que o YouTube gera ao criar o job é brinde, não backfill pedido; perder parte dele não é falha. Conferência: D+7, zero `expirado_sem_baixar` em `playlist%` | +12 downloads/dia | ~31/10 |

### 2.4 Terceiros e lugar

- **T1** (era "pedir `topicDetails`"): **resolvida**: já em produção e já gravado em `competitor_raw` (1.754 de 1.911; salto de 8,6 MB em 17/10) [PROD]. Sai do aceite da F0 (M2). `topicCategories` são páginas genéricas ("Tourism"): guarda-se por ser grátis; **não entra na T2**.
- **T2** (lugar, reescrita na r3, B2): **v0 determinístico e grátis, sem forja.** (1) `recordingDetails.location` e `locationDescription`, que já vêm em `competitor_raw` (553 e 557 de 1.911 vídeos, ~29% [PROD]); coordenada vira país offline (tabela de caixas por ISO2 ou GeoJSON de países no pacote). (2) Tabela `lugares(slug, pais_iso2, nivel, aliases text[])` com semente: ~250 países em pt, en e nome local, mais ~100 destinos do nicho; casamento por token em título, tags e início da descrição, depois de tirar acento e caixa. (3) A forja (F4) só **propõe** aliases novos, que entram com revisão; o casamento segue por igualdade de chave. O mesmo vale para os vídeos próprios. O evento agrega em **dois níveis**, `pais:VN` e `local:vn-phu-quoc`; na F2 roda em `pais:` primeiro e `local:` entra quando o alias existe. Teste de tabela: "Phú Quốc", "Phu Quoc", "Ilha de Phu Quoc", "Vietnã" e "Vietnam" caem em `pais:VN` e `local:vn-phu-quoc`, com a semente (não testa escolha de modelo). A contagem de outliers sem lugar fica visível (§8). Motivo: `competitor_readings` tem 0 linhas e a forja nunca produziu `temas`/`leitura-video` [PROD]; estender o kit exige instalação do dono.
- **T3** (calibração): taxa de `estourando` por canal e formato **com o mesmo motor** (não `percentile_cont` sobre as marcas), medida em produção; o plano traz a contagem de canais com n ≥ 8 por esse critério.

Fora da coleta: transcrição de terceiros (a API só entrega legenda ao dono), embedding de miniatura, texto de comentário além do E14.

## 3. Sinal

### 3.1 "Destino esquentou" (hipótese principal, D2)

Evento por **lugar** (chave de T2). Dispara quando, para a mesma chave, há ≥ 2 outliers do nicho (régua D6) nos últimos 14 dias **ou** 1 outlier muito acima da mediana do canal dele (parâmetros versionados, valores do Phil depois da T3). **n mínimo** = vídeos `tracked` com `vpd7` **no mesmo formato** (exatamente o que `median7` usa), não marcas. **Piso absoluto** = `vpd7 × 7` do mesmo `ObsVideo` (sugestão: 2.000), com a fonte no motivo. Validade do evento: 30 dias. A régua roda **por formato** (`long` e `short`): `outliers()` tem `fmt: 'long'` como padrão (`outliers.ts:62`) e 53 dos 166 vídeos recentes são Shorts [PROD]; sem isso a F2 declara "só longos" com esse motivo (I8).

Vira sugestão só com cruzamento: existe vídeo **nosso** com a mesma chave de lugar. Sem vídeo nosso, a sugestão é "vídeo novo".

**Não medido:** outlier sem `lugar`, canal sem n mínimo, ou vídeo nosso com base < 3 views/dia gera `nao_medido` com motivo; nunca "frio". Canal de terceiro com sync `atrasado`/`erro` vira fase `sem-ritmo` (`outliers.ts:22-24`) e some dos outliers: o núcleo devolve `motivoVazio: 'sync-atrasado'` com a contagem de canais `sem-ritmo` (I8).

### 3.2 "Vídeo parecido bombou"

Outlier do nicho (D6) casado com um vídeo nosso por filtro determinístico em camadas: mesmo nicho, mesmo formato, sobreposição de tokens de título, tags e início da descrição (pt e en), e lugar quando houver. A forja entra só na F4, para top-K (K ≤ 5) por vídeo nosso, nunca por par. A frase diz "mesmo lugar e mesmo tema" ou "tema parecido, lugar diferente".

### 3.3 "Meu vídeo caiu"

Queda de views/dia ou de CTR do vídeo nosso contra a mediana do próprio canal (ou do nicho, enquanto o canal tem menos de ~10 vídeos com série; declarado no motivo). É **gravado na mesma tabela** pelo gravador diário (depois do `sync-analytics-metrics`), para tela e Cowork lerem a mesma coisa. **Portão de volume (D10):** mostra impressões/dia e dias até o piso; se não chega em 28 dias, a ação é "Trocar direto". Regra exata, parâmetros e piso: Phil no plano.

### 3.4 Fonte única, gravador e leitura

- **Régua (D6):** `outliers(ctx, { maxAge: 30 })` (por formato, §3.1) com `!weak` e `phase.id === 'estourando'`. **Dívida fora da F2 (I6):** `outliers.ts:30` usa `2 *` fixo e `phaseOf` recalcula `m7` por item; trocar por `RULES.outlierMin *` (o valor é 2 nos dois casos, `rules.ts:10`) e pré-calcular `Map<canal|fmt, m7>` é item próprio, depois da promoção da A5, sem bloquear nada (1×/dia sobre ~166 itens é trivial).
- **Núcleo puro** `lib/youtube/observatorio/oportunidades.ts` (nome provisório): entrada = **projeção estreita** (`OutlierItem[]` já filtrados, vídeos próprios `{id, títulos, descrição normalizada, formato, lugar}`, `agora` injetado), não o `EngineCtx`; quem monta o `EngineCtx` é a borda. Saída = oportunidades com `tipo`, `motivo` (frase com os números, a versão da regra e a fonte do piso), `alvo`, `fonte`, `forca`, ou `motivoVazio` (`sem-historico`, `sem-terceiro-outlier`, `sem-lugar`, `forja-fora`). Nunca `[]` mudo. Teste do núcleo com literais, sem `createObservatory`.
- **Gravador:** **tarefa da agenda do A5** (`agenda/definicoes.ts`, `periodo: 'dia'`, `aPartirDaHoraSP` depois de `marcas_de_idade` e da série diária, `ligaCom: 'OBS_SINAIS_NICHO'`, só `on` liga), com o vermelho da saúde que a agenda já dá. Zero cron novo. **Custo a medir antes do plano (I4):** nenhuma tarefa da agenda monta o observatório inteiro hoje, e `load.ts` lê até `DAILY_MAX_DAYS = 365` de série de >1.880 vídeos; `sincronizar_canais` chega a 191 s e ficou `parcial/sobrou` [PROD]. Cronometrar em produção uma chamada do Cowork `youtube_observatory`: se < 50 s, `peso: 'leve'`; senão `peso: 'pesada', cedeA: ['sincronizar_canais']` com `aPartirDaHoraSP` fora da janela dela. Aceite: p95 da tarefa < teto, lido em `competitor_agenda_runs`. A mesma tarefa diária também envia as notificações pendentes (outbox, abaixo). Roda 1×/dia: `vpd7` e `median7` mudam uma vez por dia e o motor custa O(C·V·S) (~2,8 M pontos no teto) com cache frio; a 72×/dia seria desperdício. Latência de um `lugar` recém-chegado da forja: até o próximo dia (aceita-se).
- **Tabela** `niche_signals` (nome provisório): `site_id, kind, subject_key, rule_version, evidence jsonb` (ids, nunca imagem), `forca`, `status` (`aberto`, `dispensado`, `feito`, `expirado`), `first_seen_at`, `computed_at`, `expires_at`, `adiado_ate`, `dispensado_em`, motivo, `notificado_em` (outbox, I5). **Índice único parcial `(site_id, kind, subject_key) where status = 'aberto'`**: no máximo um aberto por destino; `rule_version` fora da chave. `subject_key` = chave de lugar (destino), id do vídeo de terceiro (parecido) ou id do vídeo próprio ("meu vídeo caiu", M7). **Retenção sem prazo** (é o conjunto que mede D2, junto com `niche_signal_efeitos`, §3.6; ~0,1 MB/ano, sem dado pessoal). RLS de leitura `can_edit_site(site_id)`, teste que falsifica o GUC.
- **Escrita em lote, idempotente:** (1) `update ... set status = 'expirado' where status = 'aberto' and expires_at <= now()` (mesma execução do gravador, não é job); (2) `insert ... on conflict do nothing`; (3) `update ... set evidence, forca, expires_at = greatest(...), rule_version, computed_at where status = 'aberto'`, que nunca toca `status` nem `dispensado_*`. Um evento novo para a mesma chave só nasce depois de `expirado`/`feito`, ou de `dispensado` com 30 dias de carência (o gravador consulta). Proibido `upsert` por item (N+1). **Outbox (I5):** a notificação não depende da linha devolvida pelo insert; a tarefa diária envia onde `notificado_em is null` e marca depois de `createNotification` ok; se falha, tenta de novo no dia seguinte (o dedup evita duplicar). O erro não é engolido (o padrão `catch { // Non-fatal }` de `competitor-sync.ts:1369` não vale aqui). Teste: o envio falha uma vez e sai no dia seguinte, sem duplicar.
- **Leitura (tela, contador, Cowork):** só a tabela, `where status = 'aberto' and (adiado_ate is null or adiado_ate <= now()) and expires_at > now()` pelo índice parcial, com `count(*)` na mesma consulta; a tela mostra `computed_at` e "desatualizado" quando o gravador falha. `expirado` é derivado também na leitura, então contador velho não sobrevive a gravador quebrado.
- **`getSuggestedVideos`** (`apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts:759`, hoje top 5 por nota e CTR com ≥ 1.000 views, sem paginação do limite de 1.000 linhas) vira leitora da lista. O chip "candidato" mantém a regra atual como `case` do núcleo (≥ 1.000 views, > 14 dias, não testado em 60 dias, nota/CTR).
- **Escrita (dispensar/feito):** server action com `requireSiteAdmin` no topo. Cowork: lê e dispensa pela ferramenta MCP existente `youtube_observatory` com ação nova (paridade D16), seguindo "Pipeline Integrity" (registry + doc) se houver rota.

### 3.5 Notificação (reescrita na r3, B1)

O sino lê a tabela `notifications`; `yt_notifications` está **morta** (7 linhas, última de 18/05; nenhum `.from('yt_notifications')` em `apps/web/src` além dos tipos) e `expire_old_yt_notifications()` só toca nela [PROD, V]. Usa-se `createNotification`/`fanOutToSiteAdmins` (`lib/notifications/fan-out-to-admins.ts`) com `domain: 'youtube'`, `type: 'youtube.niche_signal'`, `dedup_key: 'nicho:' || niche_signals.id` e `action_href` para a lista. `notifications` não tem CHECK de `type`; o dedup é `(site_id, user_id, dedup_key)`. **Sem** migration de CHECK, **sem** mudança em `NotificationType`, **sem** `expire-notifications`: a validade vem de `niche_signals.expires_at` e o leitor do sino filtra pelo estado da sugestão. Envio por outbox (§3.4), na transição e uma vez por sugestão, nunca a cada tique. Teste de aceite que lê o que o **sino** lê (não só o banco), para não passar em verde com a notificação invisível.

### 3.6 Como a hipótese D2 é medida (fase F2b, reescrita na r3, B3)

Fase própria, com tabela e aceite (§7).

- **Âncora:** `published_at` do vídeo de terceiro (outlier), **não** `first_seen_at` nem o disparo do evento: `estourando` exige `vpd7` (≥ 7 dias de série, `outliers.ts:25`), então o evento nasce 7 a 10 dias depois e a janela `-14..-1` "em torno do evento" já conteria o efeito. Pré: `[-28, -1]`; pós: `[+1, +30]`; a conta fecha em `pub + 34` (o detalhe `RELATED_VIDEO` de +30 só fecha por volta de +34, D+4 após a F0-a). O evento vale 30 dias, então quem calcula é a tarefa diária, não a vida do evento.
- **Métricas, em ordem:** (1) `thumbnail_impressions` por origem (R3), somando BROWSE, RELATED e SEARCH, porque mede o mecanismo da hipótese ("o YouTube passou a mostrar") e é ~15× mais numerosa que views (193 impressões por origem desde 08/09 [PROD]; o canal próprio teve 13 views em 28 dias); (2) views por origem (R4); (3) prova direta: views com `RELATED_VIDEO.detail = id do outlier` (R5), com três estados sim / não / não medido.
- **Estimador agregado, não por vídeo:** Σpós/Σpré nos pares (evento, vídeo nosso com a mesma chave) contra o mesmo Σ nos pares de controle (vídeos nossos sem a chave, mesma janela), mais o **placebo** do mesmo vídeo na mesma janela do calendário 1 e 2 anos antes, que separa a estação (o vídeo grande sai porque é a estação do destino; `yt_own_video_daily` vem desde 2015-08-27). Resultado com intervalo (bootstrap por evento). O `nao_medido` por vídeo continua na tela (base ausente), mas a hipótese é julgada no **agregado**, que acumula com o tempo; a regra "base < 3 views/dia → `nao_medido`" deixa de excluir o vídeo antigo e pequeno, que é o caso do dono.
- **Tabela** `niche_signal_efeitos(signal_id, video_id, papel 'alvo'|'controle'|'placebo', metrica, pre, pos, fechado_em, versao_regra)`, gravada pela mesma tarefa diária quando `pub + 34 <= hoje`. Retenção sem prazo.
- **Aceite:** teste do núcleo com literais (âncora na publicação; par só fecha depois de +34; placebo calculado); consulta de Phil em produção listando pares abertos e fechados; a tela diz "associação, não causa" até n de eventos ≥ (valor do Phil, no plano).

### 3.7 Reaproveitamento (nada duplicado)

| Peça | Reaproveita | Evita |
|---|---|---|
| Gravador | agenda do A5 | cron novo, 71 recálculos/dia |
| Régua | `outliers()` + `phaseOf` | régua e calibração duplicadas |
| Termos (C3), `RELATED_VIDEO` (C2/F4) | `yt_own_video_traffic_detail_daily` | job e consulta à Analytics |
| Bruto sem prazo (C1) | purge já devolve 0 | normalizadores agora |
| Notificação | `createNotification` / `notifications` (a tabela que o sino lê) | tabela nova e `yt_notifications`, morta |
| Marcador | registro `confirmado` da S6 §8.1 em `ab_native_tests` | tabela de marcador |
| Confirmar que o original voltou | `destinoDosCampos` (`ab-restore-acoes.ts:23`) + `ab-gravacao/sonda-step.ts` | leitor novo da página |
| Pausa sem escrever | `settleOnAir` **com motivo novo** `teste_youtube` (não existe hoje: **código novo**, §5.2) e o estado `pulado_teste_youtube` (só leitura em `ab-restore.ts:7`) | caminho paralelo |
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
| Lançamento (estreia ou publicado há ≤ 7 dias) | nativo, **sem portão de volume**; nunca os dois juntos (M1) |
| Short, kids, 18+, estreia/live agendada | nosso (único caminho), "indício por tempo alternado" |
| Nativo indisponível no canal (sem "recursos avançados"/verificação; canal novo pode não ter, I7) | nosso, rotulado "indício" |
| Lote | nosso, para varrer e priorizar, não para decidir |
| Publicado há ≥ 7 dias, sem volume (hoje os 33 vídeos [PROD]) | nenhum: "Sem volume para teste. Trocar direto?" |

O sistema pré-escolhe o caminho e mostra o motivo; trocar fica atrás de "Prefiro outro caminho". Teste de tabela do portão: idade 0 d / 7 d / 8 d × impressões 0 / acima do piso.

### 5.2 Marcador "Em teste no Studio" e a guarda

- Base: a guarda da S6 fase 2 (`avaliarGuarda`) **não existe no código** [V origin/main: zero ocorrências]. O registrador da S7 fase 1 existe (`lib/youtube/teste-youtube/registro/`), atrás de `AB_NATIVO_REGISTRO` (só `on` liga, `docs/ops/env-vars.md:21`), migration `20261018000006_ab_lab_s7_teste_nativo.sql` aplicada em produção [PROD, `schema_migrations`]; a flag **está ligada** em produção (resolvido, M2: `registro_teste_nativo` rodou 49× em 48 h, status ok [PROD]).
- **Dois portões separados (D11).** (a) **O marcador é sempre aceito**; se há teste nosso ativo no vídeo, dispara a pausa sem escrever, porque escrever durante o nativo cancela o teste. **Isto é código novo na função mais crítica, não reaproveitamento (I1):** `MotivoSaida` (`ab-settle.ts:22`) não tem `teste_youtube`, `ab-restore.ts:7` trata `pulado_teste_youtube` como só leitura e `pausa` hoje (`actions.ts:727`) **restaura o original**, isto é, escreve. A F1a é declarada como mudança em `settleOnAir`: motivo novo `teste_youtube`, `acao: 'pular'` em todos os campos, `estado: 'pulado_teste_youtube'` **definitivo**, sem nova tentativa automática. Sem isso, o restore pendente reescreveria o original **por cima do vencedor do YouTube** quando o marcador vencer ou o dono responder. Testes de fronteira: com B no ar; com restore `em_andamento`; com `seq` velho. A ficha avisa "No Studio, o 'original' será o que está no ar agora: {variante}", e na resposta do dia 14 "Restaurar o original" só aparece como escolha explícita do dono. (b) A ordem pausar → restaurar o original → confirmar no YouTube que voltou (`sonda-step.ts`, `variante_vista`; `destinoDosCampos`) vale só para **habilitar "Abrir no Studio"** quando o marcador ainda não existe. Teste: com teste nosso `active` e restore pendente, `confirmarTesteNoStudio` grava o registro `confirmado`, deixa o nosso `paused` com `pulado_teste_youtube` e **zero escrita no YouTube** (mock da Data API sem `update`).
- **Validade:** `RULES.testCompareMaxDays` (14, `rules.ts`) mais uma margem nomeada de 2 dias (M5), sem coluna; emenda à S6 §6.5, que hoje avisa aos 30 dias. Marcador vencido vira "sem resposta" e pede o resultado.
- **Janela de corrida (F1a):** se o cron já reivindicou a rotação (`ab_settle_claim`) quando o marcador entra, a escrita sai em até 1 ciclo; a ficha diz "pause o teste antes; o botão só libera depois". A guarda dentro da reivindicação (antes do `claim`) é F1b.

### 5.3 Ficha "Testar no YouTube"

- Até 3 variantes (título e/ou thumbnail), "Copiar título" e "Baixar imagem" por variante, thumbnail sempre em 1280×720 (abaixo disso o Studio reduz tudo a 854×480 [P]); reaproveita a regra 1280 da T1 do plano "original em alta".
- "Abrir no Studio" abre a página do vídeo. No celular: "No computador" e "Lembrar no computador" (o teste nativo é só desktop [P]).
- "Já iniciei" grava o marcador (para título, a S7 também detecta sozinha). Ao abrir qualquer ação do nosso num vídeo com ficha enviada nos últimos 14 dias sem marcador, pergunta "Você iniciou no Studio?".
- **Lembrete no dia 14** (notificação mais selo na linha e na lista; gerado pela mesma tarefa diária por outbox: coluna `lembrete_notificado_em` em `ab_native_tests`, envia onde `inicio + 14 d <= hoje` e está nulo, marca após `createNotification` ok e tenta de novo no dia seguinte, I5): "Venceu a nova", "Ficou igual", "Inconclusivo", "Não vi". **Mapeamento exato em `ab_native_tests`** (valores existentes: `estado ∈ {em_andamento, encerrado, sem_desfecho, descartado}`, `desfecho_estado ∈ {vencedor_provavel, em_andamento, sem_dado}`, `vencedor_fonte ∈ {regra, dono, data_api}`):

| Botão | `estado` | `desfecho_estado` | outros |
|---|---|---|---|
| Venceu a nova | `encerrado` | `vencedor_provavel` | `vencedor_fonte = 'dono'`, `variante_vencedora` (1 a 3), `resposta_dono = 'venceu_nova'`; `vencedor_titulo` quando houver título |
| Ficou igual | `encerrado` | `sem_dado` | `resposta_dono = 'ficou_igual'` |
| Inconclusivo | `encerrado` | `sem_dado` | `resposta_dono = 'inconclusivo'` |
| Não vi / sem resposta | `sem_desfecho` | `sem_dado` | `resposta_dono = 'nao_vi'` ou `'sem_resposta'`; nunca vencedor |

  **Migration** (r3: **não é só aditiva**, M4): `lembrete_notificado_em timestamptz`, `resposta_dono text check in ('venceu_nova','ficou_igual','inconclusivo','nao_vi','sem_resposta')` e `variante_vencedora smallint check between 1 and 3`; o CHECK atual de vencedor, que em produção se chama `ab_native_tests_check3` e não tem nome no arquivo, é trocado por `drop constraint ab_native_tests_check3` **explícito** (um `drop ... if exists` por palpite não faria nada e o CHECK velho continuaria recusando "Venceu a nova" só de miniatura); o novo CHECK tem nome e aceita `variante_vencedora` no lugar de `vencedor_titulo`. "Inconclusivo" e "Ficou igual" aparecem como "sem dado", não "empate". Testes: um caso por botão grava a linha esperada; "Venceu a nova" só de miniatura passa no CHECK; vencedor sem fonte é recusado; erro de escrita não é engolido (o lembrete não pode ficar para sempre).

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

A A5 sobe para staging em 21/10 e é **promovida sozinha em 22/10** (recado do dono); em 23/10 a promoção do dia é da A5 (T9 da E19), então o A/B combina antes de usar. Depois da promoção de 22/10, `coleta/index.ts`, `reports-step.ts`, `agenda/definicoes.ts` e `outliers.ts` ficam livres. Ressalva: um ajuste pequeno da A5 em `versoes-step.ts` (teto da E11) pode ir num push seguinte, com aviso. Arquivos da A5: `coleta/index.ts`, `reports-step.ts`, `agenda/definicoes.ts`, `observatorio/outliers.ts`, `fila-relatorios.ts`.

**Ordem (r3, I6):** o canal próprio está a ~0,5 view/dia, então "meu vídeo caiu", o portão de volume, a medida de D2 e o chip "candidato" dão `nao_medido` por semanas; o único valor imediato é cruzar o nicho com o acervo pelo lugar (F2). Logo **F2 (com o lugar determinístico) sobe e roda em paralelo com F0-a e F0-b**; depois F1a, F2b, F3 e F4. A F2 sai primeiro como leitura MCP (valor para o dono via Cowork); a tela vem na F3.

| Fase | Conteúdo | Valor | Aceite | Paralelo com a A5? |
|---|---|---|---|---|
| **F0 Coleta** | F0-a a F0-e, C4, C6, T3; tabela de eventos vazia e função de leitura (contrato fixo) | nenhum dado se perde a partir da implantação | Phil roda leitura em produção: para **cada** canal próprio conectado (token válido), inclusive os parados e o sem vídeos, jobs `ativo` dos 13 tipos e, no D+3, linha de coleta **ou motivo** (`sem_videos`); por canal, relatório `channel_traffic_source_a3` `baixado`/`vazio` com `end_time >= hoje − 4` (I3); teste apaga cada flag/variável nova e afirma o padrão. Sem `topicDetails` no aceite (M2) | **Agora:** plano da F0, migrations (`npm run db:new`), visão de termos (F0-e), C6 sem código. **Depois da promoção da A5 de 22/10:** F0-a (`fila-relatorios.ts`, se a A5 o tiver aberto), F0-b (`coleta/index.ts`, `diario-step.ts`), F0-d (`reports-step.ts`, `types.ts`) |
| **F2 Sinal via Cowork** (sobe, I6) | tabelas `lugares` e `niche_signals`, núcleo puro, lugar v0 determinístico (T2), gravador na agenda (depois de medir o custo, I4), "vídeo parecido bombou" e "destino esquentou" em `pais:` primeiro, outbox e notificação por `createNotification`, ação MCP | o dono pergunta ao Cowork "o que bombou no nicho e eu não tenho?" já na 1ª semana | Cowork e rota devolvem a mesma lista e o mesmo N; cada linha cita número e versão da regra; teste apaga o histórico e afirma o `motivoVazio` (inclui `sync-atrasado`); reexecução não duplica evento nem reabre dispensado; notificação aparece no que o **sino** lê; `OBS_SINAIS_NICHO` apagada desliga a tarefa (`catalogo.test.ts`); p95 da tarefa < teto | **Agora:** núcleo, `lugares`, tabela, migrations (antes do código que grava). **Depois da promoção da A5 de 22/10:** `agenda/definicoes.ts` |
| **F1a Ficha e marcador** (sem portão) | ficha "Testar no YouTube", marcador "Já iniciei" sempre aceito + **pausa sem escrever como mudança em `settleOnAir`** (D11, I1), lembrete do dia 14 com 4 botões e outbox (§5.3, migration com `drop constraint ab_native_tests_check3`), portão de volume ≥ 7 dias e rótulo "indício", T1 + aviso (D12), linha "nativo indisponível → nosso" (I7), recusa simples no **início** do teste nosso quando há `ab_native_tests` `em_andamento` no vídeo (uma consulta no `start`, sem `avaliarGuarda`) | o lançamento de novembro sai no nativo sem o nosso pisar nele, sem esperar portão | `start` do nosso com registro aberto → recusa com motivo; sem registro → segue; marcador com teste nosso ativo pausa sem escrita (fronteiras: B no ar, restore `em_andamento`, `seq` velho); um teste por botão; "Venceu a nova" só de miniatura passa no CHECK; ficha leva 1280×720 (Gio no Opera); no dia 14 o lembrete sai (e sai no dia seguinte se o envio falhar) | **sim**: `ab-lab/` e `teste-youtube/`, fora do território da A5 (a mudança em `settleOnAir` não é da A5) |
| **F1b Guarda completa** | `avaliarGuarda` da S6 fase 2, guarda dentro da reivindicação (M6), portões C-17 e C-17b | o nosso nunca escreve durante o nativo mesmo sem "Já iniciei" | portões da S6 | depende do teste nosso girar (C-17b exige ≥ 3 rotações); **não bloqueia o lançamento**; antes do primeiro teste nosso em vídeo com T&C |
| **F2b Medida de D2** (nova, B3) | `niche_signal_efeitos`, estimador agregado com controle e placebo (§3.6), leitura de `RELATED_VIDEO` (C4) | saber se a hipótese principal se sustenta, com intervalo | aceite de §3.6 (testes com literais, consulta do Phil de pares abertos e fechados, frase "associação, não causa") | depende de F0-a (detalhe sem atraso) e de eventos com `pub + 34` |
| **F3 Tela única** | lista "Sugestões (N)" nos dois lugares, notificação na transição | decisão em 3 segundos sem abrir o Cowork | mockup aprovado (Logan, Naksu, dono); N igual em Competidores, A/B Lab e Cowork; dispensar num lugar derruba o N no outro; canal vazio mostra motivo e régua | depois do mockup |
| **F4 Depende de dado** | thumbnail com referência condicionada ao `RELATED_VIDEO`; título complementar pela forja (top-K); forja propõe aliases de lugar; "meu vídeo caiu" com portão | ações mais caras só com evidência | cartão mostra "já recebo tráfego dele: sim/não/não medido"; título gerado não afirma número fora do contexto congelado | — |

Caminho crítico até o dono sentir valor: **F2 ∥ F0-a/F0-b → F1a (o dia 14 do 1º vídeo novo cai em dezembro) → F2b → F3.** **Ordem obrigatória:** migration antes do código que grava; `OBS_SINAIS_NICHO` no Vercel antes do deploy que a lê (desligada por padrão; teste que apaga a variável). Orçamento de builds (≤ 3 pushes/dia/terminal até 27/10): F0 e F1a cabem numa promoção combinada só se revisados até a véspera.

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
| Lugar | forja nunca produziu leitura; slug escolhido por LLM varia entre "Phu Quoc" e "Đảo Phú Quốc" | lugar v0 por `recordingDetails` + `lugares` (T2); forja só propõe |
| Notificação | passa no banco e o dono nunca a vê | `notifications` (a que o sino lê) + teste que lê o que o sino lê; outbox (§3.5) |
| Pausa do nosso | restore pendente reescreve o original por cima do vencedor do nativo | `teste_youtube` definitivo em `settleOnAir` (§5.2) |
| Medida de D2 | janela começa depois do efeito; estação confundida com efeito | âncora na publicação, controle e placebo (§3.6) |
| Cópia | thumbnail de terceiro está no Blob com URL pública (A5 §13) [P] | referência só dentro de `can_view_site`; evidência guarda id, não a imagem |

## 9. Perguntas abertas ao dono

Nenhuma decisão do dono foi contrariada pelos consertos da r3 (§13). Uma **tarefa de conferência** dele, hoje (I7): em Studio → Configurações → Canal → Qualificação de recursos, no canal novo, ver se "recursos avançados" (Test & Compare) está disponível. Se não estiver, a linha "nativo indisponível → nosso, rotulado indício" (§5.1) vale para o lançamento de novembro.

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
- **Resolvidos (M2):** `AB_NATIVO_REGISTRO` está ligada; `topicDetails` já é gravado em `competitor_raw`; o CHECK de `yt_notifications` não mudou e deixou de importar (B1).
- Dono: "recursos avançados" no canal novo (§9, I7).
- Custo de montar o contexto do observatório em produção (I4, §3.4).
- Retenção da Reporting no Google hoje (60 × 180 dias) e se algum `check` de `outcome` aceita `sem_videos`.
- Contagem de canais com n ≥ 8 pelo critério novo (§3.1) em produção.
- Semente de `lugares` (países e ~100 destinos) e fonte da tabela de caixas por país (T2).

## 12. Decisões da r2 (divergências entre Phil e Yannis, e como os achados foram aplicados)

Critério: o menor custo que não abre buraco. Todos os achados da r1 foram aplicados (Phil B1–B4, I1–I9, M1–M6; Yannis B1–B3, I1–I8, M1–M6); abaixo só o que exigiu escolha.

| # | Divergência / ponto | Decisão | Motivo |
|---|---|---|---|
| R1 | Yannis I3: canal sem `sync_enabled` fica sem job. Phil R14: os 2 canais têm 13 jobs `ativo` em produção | **Os dois estão certos.** Fato [PROD]: hoje os 2 têm `sync_enabled = true` e 13 jobs. Código [V]: o filtro `sync_enabled` existe (`coleta/index.ts:176`). Regra: jobs para todo próprio conectado, independentemente da flag, mais o critério de saúde que acusa canal sem job | job da Reporting não gasta cota; a regra fecha o buraco futuro sem mudar o presente |
| R2 | C1: Yannis M5 (tirar tipos da lista do purge) × Phil M1 (purge já devolve 0) | Nada a coletar nem mudar na lista; corrigir o comentário (o teste `purge = 0` já existe, r3 M3) | o dono quer sem prazo e já é assim; mexer na lista seria trabalho para um efeito que não existe |
| R3 | C3: Yannis (visão SQL sobre R5, zero job) × Phil (Analytics 1×/semana com janela) | **Visão SQL sobre R5.** Analytics semanal só pelo gatilho de §10 | custo zero e dado não expira; a r1 de ambos concorda que não há perda por esperar |
| R4 | C2: ambos tiram do diário. Tabela: Phil (mesma tabela com `source = 'analytics'`) | Phil, só na janela de evento, ≤ 20/dia | reaproveita a chave existente; a Reporting sobrescreve |
| R5 | Evento: Yannis (`window_key` = lugar + data, upsert condicional, `adiado_ate`) × Phil (índice único parcial `aberto`, insert + update) | Índice único parcial **e** `adiado_ate`; expirar na mesma execução do gravador + filtro na leitura | sem balde de data, nada para ficar ambíguo; Yannis M3 respeitado (nenhum job de expiração) |
| R6 | Piso absoluto: Yannis (`v.views` do `ObsVideo`) × Phil (marca D7, senão `vpd7 × 7`) | `vpd7 × 7` do mesmo `ObsVideo`, fonte no motivo | uma só fonte; as marcas só cobrem 1 canal com n ≥ 8 |
| R7 | Resultado do nativo: Yannis (`vencedor_miniatura jsonb`, `desfecho_motivo`) × Phil (`resposta_dono`, `variante_vencedora`, `valido_ate`) | Phil nas duas colunas (distingue botões no banco; vale para título e miniatura); validade por **constante** (Yannis), sem `valido_ate` | menos colunas e sem jsonb solto |
| R8 | Quando roda o gravador: Phil (1×/dia e de novo quando chega `lugar`) × Yannis (1×/dia) | 1×/dia | reexecutar o motor por causa de um `lugar` custa mais que esperar até o dia seguinte; ASAP continua atendido porque o evento vale 30 dias |
| R9 | Capacidade: Phil (rota nova 3×/dia ou execução repetida) | repetir a execução às 00 UTC **com `?passos=` validado** (r3 I2: só `vercel.json` dobraria a cota) | triplicar com rota nova é código a mais; começa pelo mínimo e mede |
| R10 | F1: Yannis (F1a sem portão + F1b) | adotado | evita travar o lançamento num portão que pode nunca fechar |
| R11 | Timing do `fila-relatorios.ts` (Phil: entra já; Yannis: arquivos da A5 esperam) | entra já só se a A5 não tiver o arquivo aberto; senão depois da promoção da A5 de 22/10 (r3) | evita conflito de edição com a A5 a 100% |

**Sem conserto nesta rodada:** piso exato, parâmetros do "meu vídeo caiu" e X de §10 (Phil, no plano); retenção da Reporting no Google; data em que os vídeos passam de ~100/dia (estimativa).

## 13. Decisões da r3 (revisão adversarial da r2, 55/100)

Todos os achados foram aplicados; nenhum contradisse decisão do dono (D1–D19), então não há pergunta nova. Só o que exigiu escolha ou tem motivo próprio:

| Achado | Decisão | Motivo |
|---|---|---|
| B1 | Notificação por `createNotification`/`notifications`, tipo `youtube.niche_signal`; fora a migration do CHECK de `yt_notifications`, a união `NotificationType` e `expire-notifications` | `yt_notifications` está morta (última linha 18/05); o aceite antigo passava em verde com o sino vazio |
| B2 | Lugar v0 determinístico (`recordingDetails` + tabela `lugares`); forja só propõe aliases (F4) | `competitor_readings` = 0 linhas e a forja nunca produziu `temas`; escrita na forja é do dono |
| B3 | D2 vira a fase F2b, com `niche_signal_efeitos`, âncora em `published_at`, conta fechada em +34, impressões antes de views, estimador agregado com controle e placebo de 1 e 2 anos | a janela da r2 já continha o efeito; vídeo antigo e pequeno era excluído por construção; sazonalidade confundia |
| I1 | Pausa sem escrever = mudança em `settleOnAir` (`teste_youtube`, `pulado_teste_youtube` definitivo), com testes de fronteira | o código não tem esse motivo e `pausa` hoje escreve; sem isso o restore sobrescreve o vencedor do nativo |
| I2 | F0-c ganha `?passos=` validado por Zod | a rota não tem modo parcial; repetir dobra a cota |
| I3 | Causa dos 16 dias corrigida (ordem por vencimento); aceite por canal | o aceite por `max(day_pt)` não depende da coleta num canal de ~0,5 view/dia |
| I4 | Medir o custo do gravador antes do plano; `leve` se < 50 s, senão `pesada` cedendo a `sincronizar_canais` | nenhuma tarefa monta o observatório inteiro hoje; `sincronizar_canais` já passa de 190 s |
| I5 | Outbox (`notificado_em`, `lembrete_notificado_em`) na tarefa diária | notificação e lembrete do dia 14 se perdiam em silêncio |
| I6 | F2 sobe e roda ∥ F0-a/F0-b; dívida de `outliers.ts` vira item próprio; F2 sai como leitura MCP | só a F2 dá valor na 1ª semana; os dois itens eram dispensáveis |
| I7 | Linha "nativo indisponível → nosso" e conferência do dono hoje | canal novo pode não ter Test & Compare |
| I8 | Régua por formato (ou "só longos" declarado) e `motivoVazio: 'sync-atrasado'` | `fmt: 'long'` é o padrão e `sem-ritmo` some com os outliers |
| M1–M7 | M1 ≤ 7 dias → nativo sem portão; M2 itens resolvidos; M3 só o comentário; M4 `drop constraint ab_native_tests_check3` explícito; M5 `RULES.testCompareMaxDays` + margem; M6 "conectado" = token válido; M7 `subject_key` do "meu vídeo caiu" = id do vídeo próprio | conforme a revisão |
| Calendário | "push de 24/10" vira "promoção da A5 de 22/10"; aviso do ajuste da A5 em `versoes-step.ts` e da promoção de 23/10 | recado do dono de 21/10 ~15:15 UTC |
