# Observatório, fase A5: desempenho dos concorrentes (coleta, medidas, telas), canal próprio (dieta do diário, retenção, origem das views em tabelas) e ciclo de vida do dado

Data: 12/10/2026 · Estado: **v2.1** (emenda de 12/10: comentários de destaque dos vídeos de concorrentes, etapa E14, e ritmo por hora, etapa E15), aguarda a leitura do dono (a triagem da seção 3 está aprovada, **com as mudanças de 3.1 e 3.3 pedidas por ele e as perguntas 9 a 20 abertas**) · Base: `staging` bf6dec37 · Decisões do dono, em ordem: `.superpowers/sdd/a5/decisoes-do-dono.md` · Matéria-prima: `.superpowers/sdd/a5/inventario-coleta.md` ("inventário"; este spec aponta para ele e não o repete) · Mockups já feitos: `docs/superpowers/mockups/2026-10-12-a4-proprio-e-ajustes/` (`REVISAO.md`, Partes C e D) · Specs irmãos: `2026-10-07-observatorio-canal-video-ui-design.md` ("spec de telas"), `2026-10-07-coleta-canais-proprios-design.md` ("spec de coleta"), `2026-10-02-observatorio-competidores-design.md`. `lib/` é `apps/web/src/lib/youtube/observatorio/`; `C/` é `apps/web/src/app/cms/(authed)/youtube/competitors/`.

Marcas: **VERIFICADO** (arquivo:linha ou consulta) = lido no código ou medido em produção em 12/10 por `supabase db query --linked` (só `SELECT`); **NC** = não confirmado, com o modo de confirmar; **[DONO]** = padrão assumido que o dono pode trocar (seção 13). As migrations propostas chamam-se **MG1 a MG9** (na v1 eram "M1 a M3", que se confundia com as medidas M1 a M10).

**Mapa:** 1 objetivo · 2 fatos conferidos · 3 triagem (aprovada) · 4 coleta dos concorrentes (E1 a E3), o que saiu do YouTube (E9), os comentários de destaque (E14, seção 4.6) e o ritmo por hora (E15, seção 4.7) · 5 medidas derivadas (E4) · 6 telas (E5) e a etapa de mockups (E13) · 7 canal próprio: dieta do diário (E6), curva de retenção (E8), origem das views em tabelas (E11) e o bruto dos relatórios em lote (E12) · 8 forja e Cowork (E7) · 9 ciclo de vida do dado, volume e cota (E10) · 10 itens de aceite · 11 riscos · 12 fora do escopo, registrado, e as fases seguintes · 13 perguntas ao dono · 14 sequência. **Quinze etapas, 143 itens de aceite.**

### O que mudou da v2 (v2.1, emenda de 12/10: decisão 19 do arquivo de decisões e dois recados posteriores do mesmo dia)

**Três decisões do dono. Só o que está listado aqui mudou; o resto do spec é o da v2.**

- **Comentários:** "Eu quero que agora a gente colete também os comentários nos vídeos de terceiro. Achei que não precisava, mas acho que podemos tirar valor. Vamos coletar cerca de 12 comentários, divididos da seguinte forma: comentários mais curtidos, e interagidos por canais verificados ou o próprio criador." Desfaz a linha "Texto e autor de comentários: não coletar" da triagem aprovada no mesmo dia.
- **Identidade de quem comentou:** "para a LGPD ficar feliz, vamos guardar o nome + comentário e foto pelos 30 dias, ou seja, uns 28 dias a gente guarda, depois deleta estes dados e fica nullable ou algo assim. A gente lê o comentário, mas não sabe de quem foi."
- **Ritmo por hora:** "Dá para a gente descobrir o pico de curtidas meu e dos outros? Se aumentarmos a frequência do cron… eu quero saber se das 21 às 23 horas tem mais likes do que das 3 às 5 da manhã."

1. **Triagem:** a linha de comentários sai de 3.3 e entra em 3.1, com ressalvas; a leitura de hora em hora entra em 3.1. O não-objetivo (f) da seção 1 foi reescrito.
2. **Etapa nova E14, seção 4.6** (migration MG8), comentários de destaque: o que a API permite e não permite de cada critério (conferido na documentação oficial em 12/10, com o link de cada afirmação), a regra de seleção dos 12, os marcos de coleta (idades 1, 7 e 30 dias do vídeo), o que se grava, o DDL, duas medidas sem IA (M11 e M12) e o mockup 20.
3. **O que a API não dá para comentários, dito sem rodeio:** não existe ordenação por curtidas (só "relevância", que a documentação não define); não existe campo de **coração do criador** nem de **comentário fixado**; e **não existe campo de "canal verificado"**, nem no comentário nem no canal. O critério "interagido por canal verificado" **não pode ser cumprido como foi dito**; 4.6.2 traz os substitutos e a escolha é a pergunta 9.
4. **Identidade do autor com prazo (4.6.6):** nome, id do canal e URL da foto ficam em colunas anuláveis e são apagados 28 dias depois da primeira coleta, por uma rotina diária idempotente que falha em vermelho; o texto, as contagens e os sinalizadores ficam; o criador não é anonimizado. É desenho de minimização decidido pelo dono, sem parecer jurídico, e **é pseudonimização, não anonimização** (risco 19).
5. **Etapa nova E15, seção 4.7** (migration MG9), ritmo por hora. **A API não entrega nada por hora**, nem para terceiros (só o contador acumulado de agora) nem para o canal do dono (a Analytics API só tem dia e mês; o "tempo real" de 48 horas do Studio não existe na API). O desenho é por amostragem: ler os contadores de hora em hora e guardar a diferença, **sem linha crua por vídeo e hora** (custaria de 3,5 a 46 MB por canal por ano): fica a curva das primeiras 72 horas, hora a hora, e um mapa pequeno por canal e mês (hora × dia da semana); o resto é descartado. Duas medidas (M13 e M14) e o mockup 21. **O limite principal:** a diferença mostra quando o YouTube atualizou o contador, não quando a pessoa curtiu; se o contador andar em lotes de várias horas, o mapa daquele contador não é mostrado, e isso só se sabe depois de 14 dias de leitura (item 140).
6. **Volume e cota refeitos só nas linhas afetadas, em 9.5:** cada canal passa de cerca de 5,8 para cerca de 8,0 MB por ano (comentários 1,3; ritmo por hora 0,85; estimativas, a medir) e a cota, de cerca de 240 para cerca de 310 unidades por dia com 15 canais. **A folga do plano gratuito sem arquivo cai de 38 para cerca de 30 meses com 15 canais e de 30 para 24 com 20; com corte de 12 meses, os 15 canais de hoje deixam de caber em cinco anos.** Onde 9.1, 9.3, 9.4 e o item 6 do bloco abaixo divergirem de 9.5, vale 9.5.
7. **Itens de aceite 107 a 143** (seção 10); **riscos abertos 19 a 26** (seção 11.2). O "seguir" de 11.1 foi dado para estatística pública de canal e de vídeo; o texto de comentários é conteúdo de usuário e o risco 20 pede a confirmação dele (pergunta 14).
8. **Perguntas novas ao dono: 9 a 20** (seção 13; a 15 já foi respondida). **Sequência:** a E14 e a E15 entram depois da E2 (seção 14).

### O que mudou da v1 (decisões do dono de 12/10: itens 6 a 10 do arquivo de decisões e quatro recados posteriores do mesmo dia; onde divergem, vale o último)

1. **Triagem (seção 3): aprovada.** Saiu das perguntas.
2. **A curva de retenção do canal próprio entra** (etapa nova E8, seção 7.2): tabela, coleta, tela, e uma conferência de leitura como primeiro passo. **E o canal próprio entra em tabelas, de uma vez** (etapa nova E11, seção 7.3): origem de tráfego, termos de pesquisa e sites externos, dispositivo, país e inscrito × não inscrito, com gravação esparsa, coleta diária e retroação. **E a primeira etapa do canal próprio é ligar já os 10 tipos de relatório em lote desligados e guardar o bruto** (etapa nova E12, seção 7.4; sem migration), para parar de perder o que expira. Ficam fora o diário ampliado e a demografia em tabela. **Há uma data:** relatórios já gerados com termos de pesquisa vencem na origem a partir de cerca de 07/11/2026 se não forem baixados.
3. **"Dá para inferir a retenção de um concorrente?" Não.** Entra uma leitura nova, M10 "pico sem cauda" (seção 5), que é indício declarado, não número de retenção.
4. **O que saiu do YouTube fica guardado por padrão**, numa fila em que o dono decide caso a caso (etapa nova E9, seção 4.5). A "lápide após 30 dias" da v1 saiu.
5. **Ciclo de vida do dado, sem compactação** (etapa nova E10, seção 9): o dado antigo é exportado, conferido, levado ao NAS pelo dono e só então apagado do banco online. A idade de corte é parâmetro (padrão proposto: 12 meses online, lotes semestrais). **Nesta fase ficam as regras, o comando de export com conferência e o sinal de "banco chegando ao limite"**; arquivar por idade, o banco no NAS e o botão "Ver antigo" são a fase de manutenção, em spec próprio, que o dono pretende fazer na semana que vem.
6. **A conta de volume foi refeita** (9.3) e traz um achado que corrige a expectativa: o arquivo estabiliza a **série** (dois terços do volume), mas não o banco inteiro; o que nunca sai do online cresce cerca de 2,2 MB por canal por ano. O "teto de 55 canais" deixa de ser padrão e vira saída de emergência. **Folga sem arquivo nenhum, já com a dieta e as tabelas novas do canal próprio:** 38 meses com 15 canais, 30 com 20, 22 com 30, 17 com 40. Nenhum cenário realista fica abaixo de 9 meses; como a fase de manutenção está marcada para a semana que vem, o número é informação e não manda na ordem.
7. **TikTok** e a **fase de manutenção com NAS** registrados como specs à parte (12.2). **Perguntas** refeitas: sobraram 8 (seção 13). **Sequência** refeita (seção 14), com uma **etapa explícita de mockups** (E13, seção 6.5): quem faz, a lista em ordem, o que cada um tem de mostrar, o rito de aprovação em dois crivos (o agente `revisor-ux-senior` mede e dá veredito antes de o dono abrir) e o que não espera mockup.
8. Mexidas menores que decorrem das acima: medida M1 passa a ser gravada nas idades 1, 7 e 30 (tabela pequena, MG4), para sobreviver ao arquivamento da série; motivo novo de "não medido": "arquivado"; itens de aceite 54 a 106.

## 1. Objetivo, não-objetivos, critério de sucesso

**Objetivo (dono, 12/10).** Entender o sucesso e o fracasso de cada canal concorrente: "queremos dados para entender a performance, como um canal está se saindo, engajamento". O critério de coleta é **"o que explica desempenho"**, não "tudo o que a API devolve" (estreitado pelo dono no mesmo dia; vence o brief e o inventário onde divergirem).

**Perguntas que o dono passa a responder sobre um concorrente** (hoje não consegue, ou só em parte):

| # | Pergunta | Hoje | Com a A5 | Medida (seção 5) |
|---|---|---|---|---|
| P1 | Este canal está subindo ou descendo? | só inscritos em 30 dias e views por dia dos 50 acompanhados | direção em três leituras, cada canal contra ele mesmo | M3 |
| P2 | Quais vídeos puxam o canal? | múltiplo por faixa de idade | views na mesma idade (1, 7, 30 dias) e curva por idade | M1, M2, M4 |
| P3 | O que ele mudou antes de subir? | troca de título, miniatura e descrição | mais tags, categoria, duração, idioma, capítulos, formato, playlists, tudo num eixo de tempo | M5 |
| P4 | Com que ritmo publica, e é regular? | vídeos por semana em 13 semanas | intervalo mediano, semanas cobertas, maior buraco | M6 |
| P5 | O público reage? | engajamento sobre o total de hoje | curtidas e comentários por view na mesma idade | M7 |
| P6 | O que morreu? | "parado" por dias sem publicar | canal parado, em queda sustentada, fora do ar; vídeo que sumiu; vídeo de pico × perene | M8, M9 |
| P7 | As primeiras horas decidem? | nada (uma leitura por dia) | leituras de 6 em 6 horas nas primeiras 72 horas | M1 (idade 1 dia) |
| P8 | Este vídeo estourou e parou, ou segue rendendo? | nada | uma leitura declarada como indício: muitas views cedo, quase nenhuma depois, pouca reação | M10, M9 |

E duas perguntas sobre o **canal próprio**, pedidas pelo dono em 12/10: **onde as pessoas saem de cada vídeo meu?** (curva de retenção, seção 7.2) e **de onde vêm as views de cada vídeo, o que pesquisaram, em que aparelho e de que país?** (seção 7.3).

**Não-objetivos.** (a) Nenhuma coleta nova do canal próprio **além do bruto dos relatórios em lote (7.4), da curva de retenção (7.2) e das cinco famílias de 7.3**; o diário ampliado e a demografia em tabela seguem fora (12.1). (b) Nada que a API não dê para canal de terceiro (seção 3.3); raspagem de página não é proposta. (c) Nenhuma IA nas medidas: são contas fixas, com a conta escrita no ⓘ. (d) Nenhuma mudança no kit da forja (seção 8). (e) Nenhum contorno técnico da política de 30 dias (seção 11.1). (f) Comentários de terceiros: **mudou em 12/10 (v2.1)**. Entra uma amostra de cerca de 12 comentários de destaque por vídeo (seção 4.6). Continuam fora: todos os comentários de um vídeo, as respostas de quem não é o criador, a identidade do autor além de 28 dias, e qualquer leitura do texto por IA (decisão à parte, 4.6.8).

**Critério de sucesso da fase.** (1) Depois de E1 e E2, nenhum dia passa sem a leitura dos dados da triagem, provado por consulta (itens "nada se perde"). (2) Cada pergunta P1 a P7 tem na tela um número com base, janela e viés escritos, ou um "não medido" com motivo e a data em que passa a existir. (3) O banco fica dentro dos 500 MB do plano gratuito: há um sinal que avisa com meses de antecedência um export conferido que já serve para remover canais (exportar, conferir, o dono confirma que está no NAS, só então apaga), e as regras do arquivamento por idade prontas para a fase de manutenção (seção 9). (4) O diário próprio cai de 72 MB para menos de 2 MB sem que nenhuma tela da A4 mude de número. (5) A página de cada vídeo próprio mostra a curva de retenção real, ou "não coletada" com o motivo. (6) Nada que saiu do YouTube é apagado sem uma resposta do dono. (7) Para cada vídeo próprio, a origem das views, o aparelho, o país e a divisão entre inscritos e não inscritos existem por dia desde a publicação (ou desde o limite que a API der, escrito na tela), e os termos de pesquisa desde 08/09/2026, sem perder nenhum relatório que ainda esteja disponível na origem.

## 2. Fatos conferidos em 12/10 (o que manda no desenho)

1. **A série de vídeo só cobre os "acompanhados".** `loadTracked` lê os `video_limit` (50) mais recentes mais os fixados (`competitor-sync.ts:163-174`); 674 de 1.389 vídeos tinham linha no último dia; série de 03/10 a 11/10 (9 dias, 5.480 linhas, 909 kB, 166 B por linha com índices). VERIFICADO (consulta).
2. **Um vídeo novo já entra na série no dia em que é descoberto**, porque entra nos 50 mais recentes; o que falta é (a) canal que publica mais de 50 em pouco tempo (máximo medido: 152 vídeos em 90 dias num canal; mediana 14), (b) os 715 vídeos antigos sem série, (c) as primeiras horas (uma leitura por dia, 12:00 de São Paulo).
3. **Tags, categoria e duração são sobrescritas** a cada sincronização (`competitor-sync.ts:529-532`); só título, miniatura e descrição têm versão (`competitor_video_versions.field in ('title','thumb','desc')`, migration `20261003000002`).
4. **Comentário ausente vira 0** em `competitor_videos.comment_count` (`competitor-sync.ts:467`, `parseInt(... ?? '0')`); 64 vídeos têm 0 hoje e não se sabe quantos são "desligados". A linha diária já grava nulo (`:582`).
5. **Vídeo que some do YouTube fica congelado**: `videos.list` não o devolve, a linha não é atualizada nem marcada; nada é apagado. Só o vídeo fixado ganha o estado "sem resposta" (`types.ts`, `pinState`).
6. **Canal por dia existe desde 01/06/2026** (`competitor_channel_snapshots`: inscritos, vídeos, views; 1.237 linhas). É o histórico mais longo que há e cruza a mudança de contagem de views de 24/08/2026 (inventário 2.1).
7. **O motor recusa intervalo sobre dia faltante** (`series.ts`, `intervalsOf`: "a hole: no interval across a missing day") e o carregador só lê série de vídeo observado, com teto de 365 dias (`load.ts:109`, `:637`). O pacote de um canal em cache tem teto de 2 MB (`pack.ts`, `PACK_BUDGET`). Qualquer série nova mexe nesses três pontos.
8. **`deriveChanges` deriva as trocas das versões**, não de `competitor_changes` (`changes.ts`); `competitor_changes` serve a salvos, notificação e ao endpoint `competitors/changes` do Cowork. A conta "Trocas N" das telas é título + miniatura.
9. **`youtube_quota_usage` está vazia** (0 linhas): as unidades de concorrentes não são registradas, embora `syncCompetitorChannel` as conte (`unitsUsed`).
10. **Miniaturas:** uma cópia por versão no Vercel Blob, acesso público, `observatorio/thumbs/<uuid>/<dhash>.jpg`, na maior resolução disponível (`thumb-fingerprint.ts:84-108`); 707 arquivadas.
11. **Banco:** 179 MB. `yt_own_video_daily` 72,0 MB (40%): 96.892 linhas, 35 vídeos, 26/08/2015 a 09/10/2026; **94.437 linhas sem nenhuma atividade** (97,5%); 22 linhas com views 0 e outra atividade (curtida, inscrito); 14 linhas com valor negativo (descurtida); **nenhum buraco** (cada vídeo tem um intervalo contínuo que começa no dia da publicação); linha média de 215 B, ou seja, cerca de 40 MB da tabela são espaço vazio deixado pelas regravações da janela de 10 dias. VERIFICADO (consulta).
12. **Plano do banco:** `docs/ops/plano-custo-zero.md:144` registra "o Free tier limita 500 MB". **O dono confirmou em 12/10: o projeto está no plano gratuito.** É esse limite que dimensiona a seção 9. Tamanho do banco relido em 12/10 à noite: 178,9 MB, dos quais 6,9 MB são as tabelas `competitor_*` (consulta).
13. **Mesmas credenciais Google para tudo.** Uma `YOUTUBE_API_KEY` serve concorrentes (`cron/sync-youtube`, `C/actions.ts`), a busca de canais (`api/youtube/search-channels`), o A/B Lab (`ab-start.ts`, `cron/ab-watchdog`, `api/youtube/poll-stats`) e o cadastro de canais (`youtube/_actions/channels.ts`). Um par `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` serve o acesso autorizado do YouTube (envio, edição, Analytics e Reporting dos canais do dono: `api/social/oauth/[provider]`, `lib/social/token-refresh.ts`) **e o AdSense** (`api/adsense/authorize`, `callback`, `cron/adsense-sync`). VERIFICADO no código. Que a chave e o cliente OAuth pertencem ao mesmo projeto do Google Cloud só o console confirma (o dono afirma que sim; como conferir: pergunta 5).
14. **A curva de retenção do canal próprio não é coletada.** `yt_own_video_retention` não existe em nenhuma migration (VERIFICADO, grep em `supabase/migrations/`); está desenhada no spec de coleta (lote L3: consulta, vencimento de 7 dias, tentativas, orçamento de 40 s no passo) e no inventário (etapa E4). O mockup da seção "Retenção" existe com dado de **exemplo** (`mockups/2026-10-12-a4-proprio-e-ajustes/video.html?caso=cheio`). **NC:** se a consulta respeita `startDate`/`endDate` ou devolve sempre a curva acumulada (inventário 2.2).
15. **Como o site fala hoje com a máquina de casa.** A forja **puxa**: um cron dela faz o claim na fila do site, lê por `GET` e devolve por `PATCH`/`POST`, com chave própria (runbook da forja, seção 1); o site nunca abre conexão para dentro da casa do dono. O NAS (TrueNAS SCALE, pool `fast`) publica só `studio.*`, atrás do Cloudflare Access, para o dono e o editor; a forja o alcança por NFS na rede interna (memória `project_nas_setup`, conferida em 23/09). Escrita na forja e no NAS é do dono.
16. **Dado autorizado × não autorizado nas Developer Policies** (relido na página oficial em 12/10, por ferramenta que devolve trechos): III.E.4.b permite guardar dado **autorizado** de Analytics e Reporting "for as long as is necessary", e diz que o cliente "may store this data for more than 30 days", desde que confira "every 30 days that it is still authorized by the user to access that data". III.E.4.c: os **outros** dados autorizados (por exemplo, metadados do vídeo lidos pela Data API com o acesso do dono) seguem a regra de apagar ou atualizar em 30 dias. III.D.2.c: revogado o consentimento, todo dado autorizado é apagado em até 7 dias. O limite de 30 dias para estatística vale para dado **não autorizado** (concorrentes; seção 11.1). Consequência para 7.2 e 7.3: retenção, origem de tráfego, termos, dispositivo, país e alcance são estatística autorizada de Analytics e Reporting e **não têm a questão dos 30 dias**; a coleta já grava `authorization_verified_at` a cada chamada.
17. **Relatórios em lote do canal próprio, em 12/10** (consulta em `yt_reporting_reports`): quatro tipos ligados (`REPORT_TYPES_ENABLED`, `lib/youtube/reporting/types.ts:4-9`), só `channel_reach_basic_a1` com normalizador. `channel_traffic_source_a3`: 4 baixados, **38 listados e não baixados**, 24 vazios; `channel_basic_a3`: **66 listados e não baixados**; `channel_reach_combined_a1`: 21 baixados, 45 vazios. Cobrem de 08/09 a 11/10/2026. Relatório de histórico vence na origem 30 dias depois de gerado; diário, 60 (inventário 2.2). O bruto baixado é apagado 180 dias depois do download.

## 3. Triagem: o que coletar (**aprovada pelo dono em 12/10**)

**Decidida:** "acho que está bom"; "no mais acho que está certo". As três tabelas abaixo passam a ser o contrato da coleta; só 3.2 (playlists) continua esperando resposta (pergunta 1).

Regra: um dado entra se responde a uma pergunta de desempenho (P1 a P7). "Custo" é cota (unidades da Data API por canal e dia; o teto do projeto é 10.000 por dia) e espaço (por canal e ano; seção 9). Todas as contagens abaixo são públicas e lidas com a chave de API.

### 3.1 Coletar

| Dado | Como | Pergunta | Custo | Observação dita na tela |
|---|---|---|---|---|
| Canal: inscritos | série diária (já existe) | P1, P6 | 0 a mais | **o YouTube arredonda a 3 algarismos**; variação menor que o arredondamento é "≈ 0"; canal que esconde a contagem é "não medido: inscritos ocultos" |
| Canal: views totais | série diária (já existe) | P1, P6 | 0 | inclui Shorts e vídeos apagados; regra de contagem mudou em 24/08/2026 |
| Canal: total de vídeos | série diária (já existe) | P4, P6 | 0 | queda = vídeo apagado ou privado |
| Vídeo: views, curtidas, **número** de comentários | série diária até 30 dias de idade e para os 50 mais recentes; semanal depois (4.3) | P1, P2, P5 | diária: 1 un. por 50 vídeos; semanal: +0,3 a 1 un./canal/dia; 3,8 MB | curtidas ocultas e comentários desligados são "não medido", nunca 0 |
| Vídeo: as mesmas três contagens, de 6 em 6 horas, nas primeiras 72 horas | leitura das sincronizações que já acontecem | P7, P2 | 0 un.; 0,13 MB | só para vídeo descoberto com menos de 24 horas |
| Título, miniatura (arquivo), descrição | uma vez e quando muda (já existe) | P3 | 0 | sem mudança |
| Duração, tags, categoria, idioma do texto e do áudio | uma vez e quando muda, **com histórico** (hoje sobrescreve) | P3 | 0 un.; 0,2 MB | |
| Data e hora de publicação | uma vez (já existe) | P4 | 0 | |
| Formato: longo, Short, **ao vivo ou estreia** | uma vez e quando muda (`liveBroadcastContent`, horários de `liveStreamingDetails`) | P2, P7 | 0 un. (uma parte a mais na mesma chamada) | ao vivo e estreia distorcem as primeiras horas: ficam fora das medianas de M1 e M2 e a tela diz |
| Capítulos | derivados do texto da descrição já guardada, na leitura; nada novo é coletado nem gravado | P3 | 0 | "cálculo nosso, do texto da descrição" |
| Vídeo sumiu / voltou | data da primeira leitura sem o vídeo | P6 | 0 | "não veio mais do YouTube desde dd/mm" (apagado ou privado: a API não diz qual) |
| Comentários desligados, curtidas ocultas, inscritos ocultos | sinalizador, uma vez e quando muda (a contagem ausente na resposta) | P5 | 0 | é o motivo do "não medido" |
| Canal: nome, handle, descrição, país, data de criação, imagem | uma vez e quando muda, com histórico | P3, identificação, busca no seletor | 0 | |
| A resposta da API, **só das partes pedidas** (`snippet`, `contentDetails`, `liveStreamingDetails`; canal: `snippet`, `contentDetails`), sem `statistics` | `raw jsonb`, gravado só quando o conteúdo muda | rede de segurança: campo que a triagem deixou de tipar não se perde | 0 un.; 0,8 MB | nunca lido por tela |
| Unidades de cota gastas por dia | `youtube_quota_usage` (tabela existe, vazia) | controle do risco 11.1 | 0 | |
| **Comentários de destaque: cerca de 12 por vídeo** (texto, curtidas, número de respostas, datas, se é do criador, se o criador respondeu e o texto da resposta dele). **Entrou em 12/10 (v2.1), com ressalvas:** dado pessoal de terceiros (riscos 19 a 23), com o nome, o id do canal e a foto do autor guardados por 28 dias e depois apagados; "canal verificado" não existe na API (pergunta 9); "mais curtidos" é "os mais curtidos entre os 100 primeiros por relevância" | `commentThreads.list` nas idades 1, 7 e 30 dias do vídeo (4.6, etapa E14) | P5, e três novas: o que o público destacou, do que reclamou, o que o criador escolheu responder | ≈ 1,35 un./canal/dia; ≈ 1,3 MB/canal/ano (9.5) | "12 de N lidos"; "comentários desligados" × "sem comentários" × "não coletado"; o texto é de terceiros, sem filtro |
| **Ritmo por hora: views, curtidas e número de comentários lidos de hora em hora** nos vídeos de até 14 dias (dos concorrentes e do canal do dono), guardados como curva das primeiras 72 horas e como mapa do canal por mês (hora × dia da semana). **Entrou em 12/10 (v2.1)** | `videos.list` a cada hora, 50 vídeos por chamada (4.7, etapa E15) | P7, e duas novas: em que horas o público reage; a que horas os vídeos ganham tração | 48 a 384 un./dia no total; ≈ 0,85 MB/canal/ano (9.5) | **"quando o contador mudou, não quando a pessoa curtiu"**; horário de São Paulo; "não medido: poucos vídeos recentes" |

### 3.2 Coletar depois, se barato (E3, decisão na pergunta 1)

| Dado | Pergunta | Custo |
|---|---|---|
| Playlists do canal: nome, data, tamanho, e os vídeos de cada uma (estratégia de série) | P3, P2 ("o vídeo entrou numa série antes de subir?") | semanal; 1 un. por 50 playlists mais 1 un. por 50 itens de cada playlist: cerca de 1,5 un./canal/dia com 10 playlists; 0,15 MB |

### 3.3 Não coletar

| Dado | Por quê |
|---|---|
| ~~Texto e autor de comentários~~ | **Deixou de valer em 12/10 (v2.1).** O dono mudou a decisão: "achei que não precisava, mas acho que podemos tirar valor". Passou para 3.1 como amostra de cerca de 12 por vídeo (4.6). O motivo antigo ("dado pessoal de terceiros") continua verdadeiro e virou risco (11.2, itens 19 a 23). Seguem fora: **todos** os comentários de um vídeo, as respostas de quem não é o criador, e a identidade do autor (nome, id do canal, foto) além de 28 dias |
| `localizations` | traduções de título: não explicam desempenho no nicho acompanhado; dobram o `raw` |
| `brandingSettings` (palavras-chave, trailer) | o que identifica o canal já vem em `snippet`; o resto não responde a nenhuma pergunta |
| `topicDetails` | categorias genéricas da Wikipédia; a categoria do vídeo já entra |
| `status` (licença, incorporável, "feito para crianças", privacidade) | sem efeito medível; o sumiço do vídeo é detectado pela ausência na resposta. Ressalva honesta: "feito para crianças" desliga comentários e notificações; se um concorrente infantil entrar, reabrir |
| Restrição de região, definição, dimensão, projeção, legenda (`contentDetails.caption` continua vindo dentro do `raw`, sem coluna) | não respondem a P1 a P7 |
| `captions.list` | 50 unidades por vídeo e exige autorização do dono do vídeo: não existe para terceiro |
| `channelSections` | vitrine da página inicial: sem pergunta de desempenho |
| Patrocínio pago, data de gravação | idem |
| Espectadores simultâneos de ao vivo | só existem durante a transmissão; quatro leituras por dia não os pegam; não prometido |

### 3.4 Não existe para canal de terceiro (a API não dá; não entra; nada o substitui)

**"Momentos mais vistos"** (o gráfico de trechos mais repetidos da página do vídeo), **retenção**, **impressões**, **taxa de clique**, **tempo de exibição**, **origem de tráfego**, demografia, inscritos ganhos por vídeo, receita. Só o dono do canal vê esses números (inventário 2.5). Ler a página do YouTube por fora da API viola os Termos e **não é proposto**. Para os vídeos do **próprio** canal, o equivalente a "momentos mais vistos" é a curva de retenção: **entra nesta fase** (seção 7.2).

**Não dá para inferir a retenção de um concorrente** (pergunta do dono em 12/10: "1 milhão de views que saiu nos primeiros 60 segundos não é performance boa"). A frase é verdadeira, mas nenhum dado público diz quanto tempo alguém assistiu: um vídeo com 1 milhão de views em que todos saem no primeiro minuto e outro em que todos ficam até o fim devolvem a mesma contagem. O que existe são **indícios indiretos** de que o YouTube deixou de recomendar um vídeo, reunidos na leitura M10 "pico sem cauda" (seção 5). Nenhum número de retenção de terceiro aparece em tela, e a palavra "retenção" nunca é usada para vídeo de terceiro.

## 4. Parte 1: coleta dos concorrentes

Princípios, valem para E1 a E3:

- **D1. Nada de chamada nova por vídeo.** As partes novas entram nas chamadas que já existem (`videos.list` de 50 em 50, `channels.list`).
- **D2. Nunca zero por falta.** Contagem ausente na resposta é nulo mais o sinalizador; o leitor diz o motivo.
- **D3. O estado atual fica em `competitor_videos` e `competitor_channels`; o histórico fica em tabela própria.** A conta "Trocas" das telas (título + miniatura) e `competitor_changes` não mudam: nenhum tipo novo entra em `competitor_video_versions.field` nem em `competitor_changes.change_type`, para que contagens, notificações e o endpoint do Cowork continuem dizendo o mesmo número.
- **D4. A regra de contagem de views é função da data** (corte em 24/08/2026 na Data API), calculada por uma função única no código (`countRuleOf(dia)`), **sem coluna** nas tabelas de série. Diverge do inventário (que propunha `count_rule text`): a coluna custaria cerca de 15% do espaço da maior tabela para guardar um valor derivável.
- **D5. Dia:** `snap_date` é a data de São Paulo (UTC-3), como hoje. Nunca se junta ao "dia do YouTube" do canal próprio sem aviso.
- **D6. RLS no padrão existente de `competitor_*`:** `enable row level security`; leitura por `public.can_view_site(site_id)` (dado público do YouTube, mesmo nível das tabelas atuais); `raw` por `public.can_edit_site(site_id)`; nenhuma policy de escrita (só service role); sempre `drop policy if exists` antes de `create policy`. Toda tabela nova leva `site_id` desnormalizado.
- **D7. Migration só com o dono**, criada por `npm run db:new <nome>`; o DDL abaixo é proposta em texto, aditivo e idempotente.

### 4.1 Etapa E1: campos com histórico, sinalizadores, `raw` das partes pedidas

**O que se perde a cada dia sem ela:** a data de cada mudança de tags, categoria, duração, idioma e formato; a diferença entre "0 comentários" e "comentários desligados"; a data em que um vídeo sumiu.

**Coleta.** `videos.list?part=snippet,statistics,contentDetails,liveStreamingDetails` (hoje sem a última) nas três chamadas existentes (página de uploads, passada diária, fixados; a passada diária hoje pede só `snippet,statistics` e passa a pedir as quatro). `channels.list?part=contentDetails,snippet,statistics` não muda. Custo: 0 unidade a mais (o quadro de cota cobra por chamada, não por parte; inventário 2.3).

**DDL proposto (migration MG1).**

```sql
-- 1. Estado atual do vídeo (colunas novas; nulo = a API não devolveu)
alter table public.competitor_videos
  add column if not exists discovered_at timestamptz,          -- instante da 1ª leitura; nulo nas linhas antigas (nunca preenchido por palpite)
  add column if not exists default_language text,
  add column if not exists default_audio_language text,
  add column if not exists live_broadcast_content text,        -- 'none' | 'upcoming' | 'live'
  add column if not exists live_scheduled_start_at timestamptz,
  add column if not exists live_actual_start_at timestamptz,
  add column if not exists live_actual_end_at timestamptz,
  add column if not exists was_live boolean,                   -- a resposta trouxe liveStreamingDetails: ao vivo OU estreia
  add column if not exists comments_disabled boolean,          -- commentCount ausente na resposta
  add column if not exists likes_hidden boolean,               -- likeCount ausente na resposta
  add column if not exists missing_since date,                 -- 1ª data (São Paulo) em que videos.list não devolveu o vídeo; nulo = veio
  add column if not exists last_seen_at timestamptz,           -- última leitura em que o vídeo VEIO (a "última contagem" da fila de 4.5 é desta data)
  add column if not exists removal_decision text check (removal_decision in ('manter')),  -- resposta do dono na fila de 4.5; nulo = sem resposta (o dado fica)
  add column if not exists removal_decided_at timestamptz,
  add column if not exists removal_decided_by uuid;            -- auth.users.id de quem respondeu
alter table public.competitor_videos alter column view_count drop default;   -- hoje default 0

-- 2. Estado atual do canal
alter table public.competitor_channels
  add column if not exists custom_url text,                    -- handle
  add column if not exists description text,
  add column if not exists published_at timestamptz,           -- criação do canal
  add column if not exists country text,
  add column if not exists subscribers_hidden boolean,
  add column if not exists missing_since date,                 -- channels.list sem item
  add column if not exists last_seen_at timestamptz,
  add column if not exists removal_decision text check (removal_decision in ('manter')),
  add column if not exists removal_decided_at timestamptz,
  add column if not exists removal_decided_by uuid;
alter table public.competitor_channel_snapshots
  add column if not exists subscribers_hidden boolean;

-- 3. Histórico de campo (mesma forma de competitor_video_versions: uma linha por valor, com início, fim e precisão)
create table if not exists public.competitor_field_versions (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  video_id uuid references public.competitor_videos(id) on delete cascade,   -- nulo = campo do canal
  field text not null,                 -- catálogo no código (abaixo); sem check: campo novo não exige migration
  value jsonb,                         -- o valor como veio; nulo = a API deixou de devolver
  value_hash text not null,            -- sha256 do JSON canônico (chaves ordenadas)
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  window_start timestamptz,            -- última leitura boa antes da mudança (a mudança ocorreu entre window_start e first_seen_at)
  precision text not null check (precision in ('6h', '1d', '7d', 'first')),
  is_current boolean not null default true
);
create unique index if not exists idx_cfv_one_current_video
  on public.competitor_field_versions (video_id, field) where is_current and video_id is not null;
create unique index if not exists idx_cfv_one_current_channel
  on public.competitor_field_versions (competitor_channel_id, field) where is_current and video_id is null;
create index if not exists idx_cfv_channel_seen
  on public.competitor_field_versions (competitor_channel_id, first_seen_at);
alter table public.competitor_field_versions enable row level security;
drop policy if exists "competitor_field_versions_select" on public.competitor_field_versions;
create policy "competitor_field_versions_select" on public.competitor_field_versions
  for select using (public.can_view_site(site_id));

-- 4. Resposta das partes pedidas, só quando muda
create table if not exists public.competitor_raw (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  video_id uuid references public.competitor_videos(id) on delete cascade,   -- nulo = resposta do canal
  raw_sha256 text not null,            -- do JSON canônico SEM statistics, etag e concurrentViewers
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  is_current boolean not null default true,
  raw jsonb not null
);
create unique index if not exists idx_craw_one_current_video on public.competitor_raw (video_id) where is_current and video_id is not null;
create unique index if not exists idx_craw_one_current_channel on public.competitor_raw (competitor_channel_id) where is_current and video_id is null;
alter table public.competitor_raw enable row level security;
drop policy if exists "competitor_raw_select" on public.competitor_raw;
create policy "competitor_raw_select" on public.competitor_raw for select using (public.can_edit_site(site_id));
```

- **Chave e índices:** identidade própria, não `(id, hash)` como no inventário: um valor que vai e volta (A, B, A) repete o hash e quebraria a chave. O índice parcial `is_current` dá o estado de agora sem varrer o histórico.
- **Catálogo de campos** (constante em `lib/`, com teste que falha se um campo for gravado fora dele). Vídeo: `tags`, `category_id`, `duration_seconds`, `default_language`, `default_audio_language`, `live_broadcast_content`, `comments_disabled`, `likes_hidden`, `availability` (`'no_ar'` | `'sumiu'`). Canal: `name`, `custom_url`, `description`, `country`, `avatar_url`, `subscribers_hidden`, `availability`. A primeira linha de cada campo tem `precision = 'first'` e **não é mudança**. Título, miniatura e descrição continuam em `competitor_video_versions`.
- **Unidades:** instantes em UTC; `duration_seconds` inteiro; `value` de `tags` é a lista na ordem da API (reordenar é mudança, e a tela diz "mesma lista, outra ordem").
- **Escrita atômica:** uma função `apply_competitor_field_plan(p_channel uuid, p_video uuid, p_close bigint[], p_open jsonb)` no molde de `apply_competitor_version_plan` (security invoker, `search_path` fixo, `execute` só para `service_role`): fecha e abre versões na mesma transação. O `raw` usa o mesmo molde.
- **Sumiço:** vídeo pedido e não devolvido por `videos.list` ganha `missing_since` e uma versão `availability = 'sumiu'`; se voltar, `missing_since` vira nulo e abre `'no_ar'`. Uma leitura só não basta: marca na **segunda** leitura seguida sem o vídeo (falha de rede não é sumiço). **A E1 só marca; nunca apaga.** O que acontece depois é a fila de 4.5 (etapa E9): o dado fica até o dono responder.
- **Conserto junto (sem migration):** `comment_count` deixa de receber 0 por falta (`competitor-sync.ts:467` passa a usar `optCount`); as 64 linhas com 0 ficam como estão até a próxima leitura as corrigir. As unidades de cota de cada execução passam a ser gravadas em `youtube_quota_usage` (soma do dia e, em `operations`, o total por modo).
- **`competitor_channel_removal_impact`** é recriada contando as duas tabelas novas.
- **Zero × não medido:** coluna nula = a API não devolveu; sinalizador `true` com contagem nula = "não medido" com motivo.
- **Retroação:** nenhuma. O histórico começa na primeira leitura depois do deploy; a tela diz "histórico de tags, categoria e duração desde dd/mm".

### 4.2 O que o Blob guarda (sem mudança)

Uma cópia por versão de miniatura, como hoje (fato 10). Nada novo é arquivado: a imagem do canal entra só como URL no histórico de campo. O Blob continua com URL pública nesta fase (padrão assumido, seção 13). Duas saídas apagam arquivos dele: a resposta "apagar" da fila de 4.5 e a remoção de um canal inteiro (9.2).

### 4.3 Etapa E2: série desde o dia 0, primeiras horas, catálogo semanal

**O que se perde a cada dia sem ela:** a série dos 715 vídeos antigos (a API só dá o valor de agora); as primeiras horas de todo vídeo novo; os dias de um vídeo empurrado para fora dos 50 por canal que publica muito.

**Regra de cadência (explícita, calculada a cada sincronização).**

| Faixa | Quem | Leitura |
|---|---|---|
| **Primeiras horas** | vídeo com `discovered_at − published_at ≤ 24 h`, enquanto a idade for menor que 72 h | em toda sincronização do canal (4 por dia: 00, 06, 12 e 18 de São Paulo), em `competitor_video_early` |
| **Diária** | idade ≤ 30 dias, **ou** entre os `video_limit` (50) mais recentes do canal (regra de hoje, sem regressão), **ou** fixado, **ou** promovido (`daily_until ≥ hoje`) | uma linha por dia, 12:00 de São Paulo, em `competitor_video_daily` |
| **Semanal** | todo o resto dos vídeos guardados | uma linha por semana, no dia `hash(id do vídeo) mod 7` (espalha a carga), na mesma tabela |

- **Promoção de semanal para diária, por 28 dias** (`daily_until = hoje + 28`): (a) o vídeo ganhou em uma semana pelo menos 1.000 views **e** pelo menos 5% do total dele [DONO, pergunta 6]; ou (b) foi detectada mudança de título, miniatura ou descrição (para medir o efeito, M5).
- **Rebaixamento:** automático quando nenhuma condição da faixa diária vale mais. Nada é apagado ao rebaixar.
- **Teto de segurança:** no máximo `RULES.videoLimitMax` (200) vídeos em faixa diária por canal, mais os fixados. Acima disso os mais antigos da regra "idade ≤ 30 dias" vão para a semanal **e a execução registra quantos** (em `youtube_quota_usage.operations` e no retorno do cron): corte silencioso é proibido.
- **O catálogo que não está guardado não é buscado.** 14 dos 15 canais estão em modo `recent` (1.389 vídeos guardados de 6.089 publicados). Buscar o catálogo inteiro é a pergunta 7; o padrão é não.

**DDL proposto (migration MG2).**

```sql
alter table public.competitor_videos
  add column if not exists series_tier text check (series_tier in ('diaria', 'semanal')),   -- nulo = ainda não classificado
  add column if not exists series_tier_since date,
  add column if not exists daily_until date;

create table if not exists public.competitor_video_early (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  taken_at timestamptz not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  views bigint not null,
  likes bigint,            -- nulo = oculto
  comments bigint,         -- nulo = desligado
  primary key (video_id, taken_at)
);
alter table public.competitor_video_early enable row level security;
drop policy if exists "competitor_video_early_select" on public.competitor_video_early;
create policy "competitor_video_early_select" on public.competitor_video_early
  for select using (public.can_view_site(site_id));
```

`competitor_video_daily` **não muda de forma** (chave `video_id, snap_date`; `views` em contagem acumulada; `likes` e `comments` nulos quando ausentes). A linha semanal é uma linha comum, mais espaçada; a faixa de cada intervalo é deduzida da distância entre dois pontos seguidos (até 36 h: diário; até 8 dias: semanal; mais: buraco), sem coluna nova.

**Efeito no código que já existe (obrigação do plano, cada um com teste):**

1. `series.ts`, `intervalsOf`: passa a aceitar intervalo semanal como **taxa média da semana**, marcado como tal; continua recusando buraco. Efeito de troca (`effect.ts`) e múltiplo "mesmo dia de vida" continuam exigindo pontos diários: sobre série semanal respondem "inconclusivo: série semanal".
2. `load.ts`: lê a série dos observados **e** dos que têm linha na janela pedida; o teto de 365 dias fica. `ObsVideo` ganha a faixa (`tier`), sem mudar o significado de `tracked` (os 50), que segue sendo a base dos números atuais das telas.
3. `pack.ts`: mais vídeos com série aumentam o pacote do canal; o teto é 2 MB. O plano **mede** o pacote do maior canal com um ano simulado antes de ligar a leitura semanal nas telas; se passar, a série semanal é lida à parte, sob demanda (página do vídeo), e não entra no pacote. `PACK_VERSION` sobe.
4. `competitor-sync.ts`: `loadTracked` vira `loadDailySet` (a regra da tabela acima); nova `loadWeeklyDue`; a leitura das primeiras horas reaproveita a resposta da página de uploads (0 chamada a mais).
5. Orçamento do cron: `runCompetitorBatch` tem 200 s por execução e 15 canais por lote (`cron/sync-youtube/route.ts`); a passada semanal soma no máximo uma chamada por 50 vídeos devidos no dia. O plano mede o tempo com 75 canais simulados antes de promover.

**Retroação:** nenhuma. Vídeo antigo ganha o primeiro ponto na semana do deploy.

> **Emenda v2.1:** com a E15 (4.7) a faixa "Primeiras horas" passa de 4 leituras por dia para **uma por hora**, na mesma tabela `competitor_video_early`, e o item de aceite 16 passa a exigir 60 leituras em 72 horas.

### 4.4 Etapa E3: playlists (só se a pergunta 1 for "sim"; migration MG3)

`playlists.list?part=snippet,contentDetails&channelId=…` e `playlistItems.list?part=snippet,contentDetails` de cada playlist, uma vez por semana e canal (mesmo espalhamento por `hash mod 7`). Teto de 50 playlists por canal e de 500 itens por playlist por semana; o que passar entra na semana seguinte e a execução registra o corte.

```sql
create table if not exists public.competitor_playlists (
  playlist_id text primary key,                       -- id do YouTube
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  title text,
  published_at timestamptz,
  item_count integer,                                 -- contentDetails.itemCount; NC se a API o devolve (inventário 2.3): nulo se não vier
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  missing_since date
);
create index if not exists idx_cpl_channel on public.competitor_playlists (competitor_channel_id);

create table if not exists public.competitor_playlist_items (
  playlist_id text not null references public.competitor_playlists(playlist_id) on delete cascade,
  youtube_video_id text not null,                     -- 11 caracteres; pode ser vídeo de outro canal
  site_id uuid not null references public.sites(id) on delete cascade,
  position integer,
  added_at timestamptz,                               -- snippet.publishedAt do item = quando entrou na playlist
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  removed_since date,                                 -- 1ª leitura sem o item
  primary key (playlist_id, youtube_video_id)
);
create index if not exists idx_cpli_video on public.competitor_playlist_items (youtube_video_id);
-- RLS nas duas: can_view_site(site_id), como em 4.1
```

Mudança de nome de playlist entra em `competitor_field_versions` (campo `playlist_title`, com o id da playlist dentro de `value`). **Retroação parcial:** `added_at` e `published_at` vêm da API, então a ordem em que a série foi montada aparece já na primeira leitura; o que saiu antes dela, não.

### 4.5 Etapa E9: o que saiu do YouTube (guardar por padrão; o dono decide caso a caso)

**Decisão do dono (12/10), que substitui a "lápide após 30 dias" da v1:** guardar tudo por padrão, com pergunta e confirmação manual, caso a caso. "Se o vídeo foi deletado por questão judicial e coisas assim a gente vai e apaga; agora se foi segredo revelado de como ter mais sucesso é bom a gente conseguir analisar."

**Regras.**

1. **Sem resposta, o dado fica.** Nenhuma rotina apaga dado de vídeo ou canal ausente: nem por prazo, nem por cron, nem pelo arquivamento de 9.2 (que só move dado antigo, e exporta antes).
2. **Entra na fila** todo vídeo ou canal com `missing_since` preenchido (segunda leitura seguida sem ele, E1) e `removal_decision` nulo. Canal que saiu inteiro é **um** item (o canal), não um item por vídeo.
3. **Sai da fila** por uma das duas respostas, ou sozinho se voltar ao ar (`missing_since` volta a nulo; a decisão anterior, se era "manter", é limpa e a volta fica no histórico de campo `availability`).

**A fila "Saíram do YouTube"** (aba do Observatório, com contador; desenho em mockup, seção 6). Cada item mostra **o que se sabe**, e só isso:

| O que | De onde |
|---|---|
| título, miniatura (a nossa cópia), canal, formato, duração | última versão guardada |
| data de publicação; data em que o Observatório o viu pela primeira vez | `published_at`, `discovered_at` (nulo nas linhas antigas: "antes de dd/mm") |
| **"não veio mais do YouTube desde dd/mm"** | `missing_since` |
| última contagem de views, curtidas e comentários, **com a data da leitura** | `competitor_videos` e `last_seen_at` |
| **o canal continua no ar?** ("sim" / "o canal inteiro também saiu, desde dd/mm") | `competitor_channels.missing_since` |
| o que há guardado: N dias de série, N versões de título, miniatura e descrição, N miniaturas no Blob, períodos já arquivados (9.2) | contagem |
| **motivo: "o YouTube não diz"** | a API devolve a mesma ausência para vídeo apagado pelo autor, tornado privado, removido por denúncia ou por ordem judicial. A tela escreve isso e **não sugere** motivo |

**As duas respostas.**

- **Manter para análise.** Grava `removal_decision = 'manter'`, quem e quando. O vídeo continua em todas as telas com a pastilha "saiu do YouTube em dd/mm · mantido para análise"; a série dele termina em `missing_since`; ele **continua** nas medidas de quando estava no ar (M1, M4, M9, M10) e a tela diz quantos vídeos fora do ar entram em cada mediana. Reversível: a pastilha tem "apagar".
- **Apagar.** Pede confirmação escrita (digitar `APAGAR`) e mostra antes a contagem do que vai sumir. Apaga, para o vídeo: a linha de `competitor_videos` e, em cascata, a série (`competitor_video_daily`, `competitor_video_early`), as marcas (`competitor_video_marks`), as versões de título, miniatura e descrição, o histórico de campo, o `raw`, as mudanças (`competitor_changes`), salvos e fixação; os itens dele em `competitor_playlist_items` (por id do YouTube); **os arquivos de miniatura no Blob** (`observatorio/thumbs/<uuid>/…`, todas as versões); e invalida o pacote em cache do canal. Para o canal inteiro: o mesmo fluxo de remover canal que já existe (`competitor_channel_removal_impact` mostra a contagem), mais as miniaturas. **Não exporta antes**: é a única exceção à regra "exportar antes de apagar" de 9.2, porque o motivo de apagar aqui é não ter mais o dado. Se parte dele já foi para o arquivo, a tela lista os arquivos que o contêm e **prepara os comandos** para o dono os apagar no NAS (um por linha; escrita no NAS é do dono), e o item só é dado por concluído quando ele marca que rodou.

**O que sobra depois de "apagar": uma linha sem conteúdo**, para o vídeo não voltar a ser tratado como novo e para o registro existir.

```sql
create table if not exists public.competitor_removed_items (       -- migration MG1
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('video', 'canal')),
  youtube_id text not null,                  -- id público do vídeo (11 caracteres) ou do canal; NENHUM título, texto, contagem ou imagem
  competitor_channel_id uuid,                -- sem FK: o canal pode ter sido apagado junto
  missing_since date,
  decided_at timestamptz not null default now(),
  decided_by uuid not null,
  rows_deleted jsonb not null,               -- contagem por tabela
  blobs_pending text[] not null default '{}',-- caminhos do Blob ainda não apagados; vazio = tudo apagado
  archive_pending boolean not null default false,  -- há cópia no arquivo esperando o dono apagar no NAS
  unique (site_id, kind, youtube_id)
);
alter table public.competitor_removed_items enable row level security;
drop policy if exists "competitor_removed_items_select" on public.competitor_removed_items;
create policy "competitor_removed_items_select" on public.competitor_removed_items
  for select using (public.can_edit_site(site_id));
```

- **Atomicidade e "falha em verde".** Uma função `competitor_video_purge(p_site uuid, p_video uuid, p_actor uuid)` (`execute` só para `service_role`) apaga as linhas e grava a linha acima na mesma transação, devolvendo os caminhos do Blob. Os arquivos são apagados **depois** do commit; o que falhar fica em `blobs_pending` e a tela mostra "faltam N miniaturas", com nova tentativa. Um item com `blobs_pending` ou `archive_pending` não é "apagado": é "apagando".
- **Quem pode.** A ação de servidor valida `canAdminSite(siteId)` antes de qualquer uso do cliente de serviço (regra do projeto).
- **Registro.** Cada resposta grava em `audit_log` (com `set_audit_context`): ação (`competitor_missing_keep` / `competitor_missing_purge`), quem, alvo (id do YouTube), contagem por tabela; **sem título nem conteúdo** no caso de apagar.
- **Se o vídeo apagado voltar ao ar:** a sincronização o encontra em `competitor_removed_items`, **não o recoleta** e põe um item na fila: "voltou ao ar; você apagou em dd/mm. Voltar a acompanhar?".
- **O que a E9 não faz:** não tenta descobrir o motivo; não lê a página do YouTube; não avisa por e-mail (só o contador na aba).

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

#### 4.6.2 "Canal verificado": os substitutos honestos (pergunta 9; o spec não escolhe)

| Opção | O que é | Custo | A favor | Contra |
|---|---|---|---|---|
| **A. Canal que o Observatório acompanha** | o autor do comentário (ou de uma resposta vista) é um dos canais cadastrados: concorrentes ou os do dono | 0 unidade; **nenhum dado novo de terceiros** (a comparação é feita na coleta e só o vínculo com o canal já cadastrado é gravado) | exato, explicável ("comentou aqui: canal X, que você acompanha") e responde a uma pergunta real: os criadores do nicho conversam entre si? | raro: com 15 canais, quase nenhum vídeo terá um. Não é "verificado" |
| **B. Autor com muitos inscritos** | `channels.list?part=statistics` para os autores do lote (50 ids por chamada, 1 unidade), e "de destaque" = inscritos ≥ um limiar (por exemplo 10.000) | até 2 unidades por vídeo e marco; traz **mais dado de terceiros** (o número de inscritos de até 100 pessoas por vídeo, a maioria gente comum) | aproxima "canal relevante" | inscritos vêm arredondados e podem estar ocultos ("não medido"); o limiar é arbitrário; é exatamente o tipo de dado que a minimização manda não buscar; não é "verificado" |
| **C. A + B** | A sempre; B só para os autores dos 20 mais curtidos do lote | até 1 unidade por vídeo e marco | menos dado de terceiros que B | os mesmos de B, em menor escala |
| **D. Abandonar o critério** | as vagas dele vão para "mais curtidos" | 0 | nada é prometido que a API não dê | perde a ideia de "quem é relevante comentou" |

Até a resposta, a regra abaixo é escrita com a vaga "autor de destaque" **vazia** (comporta-se como D), e o volume e a cota de 9.5 são contados com A (custo zero). A tela **nunca** usa a palavra "verificado".

#### 4.6.3 A regra de seleção (reproduzível, explicável na tela)

Parâmetros em `rules.ts`: `commentsTarget = 12` (o alvo do dono), `commentsCreatorMax = 4`, `commentsFeaturedMax = 2`, `commentsPool = 100`, `commentsCreatorRepliesMax = 3`. A divisão 6 + 4 + 2 é proposta do spec: o dono deu os critérios, não os números (pergunta 10).

1. **Lote.** Uma chamada: `commentThreads.list?part=snippet,replies&videoId=…&order=relevance&maxResults=100&textFormat=plainText`. As até 100 conversas devolvidas são o lote. Cada uma recebe a **posição** em que veio (1 a 100).
2. **Sinalizadores de cada conversa**, calculados na coleta: `do_criador` (o comentário de topo é do canal do vídeo); `criador_respondeu` (`sim`: há resposta do canal do vídeo entre as respostas vistas; `não`: todas as respostas foram vistas e nenhuma é dele; `não se sabe`: vieram menos respostas que `totalReplyCount` e nenhuma das vistas é dele); `autor_de_destaque` (conforme a resposta à pergunta 9).
3. **Três grupos, preenchidos nesta ordem, cada comentário em um só:**
   - **Criador** (até 4): conversas com `do_criador` ou `criador_respondeu = sim`.
   - **Autor de destaque** (até 2): conversas com `autor_de_destaque`, fora as já escolhidas.
   - **Mais curtidos** (o que faltar para 12): as demais, por curtidas.
4. **Ordem dentro de cada grupo e desempate, sempre os mesmos:** `likeCount` do comentário de topo, do maior para o menor; empate, `totalReplyCount` maior; empate, posição menor na relevância; empate, id do comentário em ordem alfabética. Com a mesma resposta da API, a seleção é sempre a mesma (item de aceite 109).
5. **Sobreposição.** Um comentário que é o mais curtido **e** tem resposta do criador entra uma vez, no grupo "criador", e leva os dois sinalizadores; a vaga de "mais curtidos" passa ao seguinte. A tela mostra os sinalizadores, não o grupo: o grupo só explica por que ele foi escolhido.
6. **Falta.** Vaga não preenchida de "criador" ou "destaque" vai para "mais curtidos". Lote com menos de 12 conversas: grava todas. Lote vazio: 4.6.5.
7. **O que acompanha o comentário escolhido:** até 3 respostas **do criador** naquela conversa (as mais antigas entre as vistas), com o texto. **Nenhuma resposta de outra pessoa é gravada.**
8. **Frase da tela** (o mockup fecha o texto): "12 comentários de 100 lidos por relevância · 7 mais curtidos · 4 com o criador · 1 de canal que você acompanha". Com lote completo: "de todos os 37 comentários". O ⓘ explica a regra e o que ela não garante (linha 1 de 4.6.1).

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
3. **O sinalizador é resolvido antes, na própria coleta.** `is_creator`, `creator_replied`, `featured_reason` e `featured_channel_id` são calculados e gravados na mesma transação em que o comentário entra. A rotina de apagar nunca precisa da identidade para decidir nada: a identidade some, o sinalizador fica. Se a pergunta 9 escolher a opção B (inscritos do autor), o número de inscritos é usado na coleta e **não é gravado**; fica só `featured_reason = 'inscritos'`.
4. **O criador não é anonimizado.** Comentário e resposta do canal do vídeo (`is_creator`) nunca têm as três colunas preenchidas: o autor é o canal acompanhado, dado público do próprio concorrente, e o nome e a imagem vêm de `competitor_channels`. O mesmo vale para o canal acompanhado que comentou (`featured_channel_id`, opção A): o vínculo com o cadastro fica, por ser um canal que o dono escolheu acompanhar, não um espectador.
5. **A rotina.** Uma função `competitor_comment_identity_purge()` (security definer, `search_path` fixo, `execute` só para `service_role`), chamada todo dia pelo cron diário de concorrentes que já existe (rota `GET`, disparada pela Vercel): anula as três colunas e grava `author_purged_at` onde `author_expires_at <= now()` e alguma delas ainda tem valor. **Idempotente:** rodar duas vezes seguidas altera zero linhas na segunda. Devolve quantas linhas anulou e **quantas estavam vencidas há mais de um dia** (o sinal de que ela deixou de rodar).
6. **Falha em vermelho.** A rotina tem chave própria em `cron_health` (`competitor-comment-identity`); 36 horas sem sucesso é falha no vigia que já existe. E, independente dela, o passo de coleta de comentários roda no começo a consulta de prova do item 125: se houver identidade com mais de 29 dias, a execução devolve `status: 'error'`, **não coleta comentário novo** e o cabeçalho do Observatório mostra "identidade de autores vencida e não apagada: N" para quem edita. Não coletar é de propósito: sem a rotina, cada coleta aumentaria o que está fora da regra.
7. **Na leitura:** os leitores de tela nunca devolvem identidade com `author_expires_at` vencido, mesmo que a rotina tenha falhado (defesa a mais; o alerta do passo 6 continua aparecendo).
8. **Fora do banco:** o export de 9.2 **nunca** leva as três colunas (o `SELECT` do export não as lê; item 127); nenhum log grava nome, id ou URL de foto; nenhum pacote do pipeline as contém.
9. **Na tela (4.6.9):** enquanto a identidade existe, o comentário mostra nome e foto com "identidade guardada até dd/mm"; depois, "um espectador".

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
  featured_reason text,                  -- nulo | 'canal_acompanhado' | 'inscritos' (catálogo no código; depende da pergunta 9)
  featured_channel_id uuid references public.competitor_channels(id) on delete set null,  -- opção A: o canal acompanhado que comentou
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
9. **Dois estados do autor:** com identidade (nome, foto pela URL, e "identidade guardada até dd/mm"; foto que não carrega vira a inicial) e sem identidade ("um espectador"), que é o estado de quase todo comentário com mais de 28 dias. O criador e o canal acompanhado aparecem sempre com nome, vindos do cadastro. A foto é carregada direto do YouTube pelo navegador de quem vê; não há cópia nossa.
10. **Quem vê:** só quem edita o site. Usuário só de leitura vê a contagem e o estado, não o texto, e a tela diz que há texto que ele não vê (não é tela vazia).
11. **Onde aparece:** na página do vídeo de concorrente (mockup 13 ganha a seção, desenhada no 20); na página do canal, M11 no cabeçalho e uma lista "o que o criador respondeu"; nada na lista de Canais nem em Comparar nesta fase.
12. Acrescenta à lista fechada de motivos de 6.1.5: "comentários desligados pelo canal" (já existia para a contagem), "a coleta de comentários começou em dd/mm", "não coletado na idade N", "o YouTube não diz se o criador respondeu (respostas cortadas)".

### 4.7 Etapa E15: ritmo por hora (emenda v2.1; migration MG9)

**Pedido do dono (12/10):** "Dá para a gente descobrir o pico de curtidas meu e dos outros? Se aumentarmos a frequência do cron… eu quero saber se das 21 às 23 horas tem mais likes do que das 3 às 5 da manhã. Não sei se a API nos entrega isso, mas se colocarmos os crons no momento certinho, podemos inferir estas janelas."

**Resposta curta: a API não entrega nada por hora, nem para terceiros nem para o canal do dono. Dá para inferir por amostragem**, lendo o contador de hora em hora e guardando a diferença, com os limites de 4.7.6, que a tela tem de dizer.

**O que se perde a cada dia sem ela:** as diferenças hora a hora daquele dia. O contador só diz o total de agora; a hora em que ele subiu não volta.

#### 4.7.1 O que a API entrega por hora (documentação oficial, lida em 12/10)

| Fonte | O que a documentação diz | Consequência |
|---|---|---|
| Vídeo de terceiro, Data API | `videos.list` devolve em `statistics` só o **total acumulado de agora**: `viewCount` ("The number of times the video has been viewed"), `likeCount`, `commentCount`. Nenhuma série, nenhum horário ([recurso video](https://developers.google.com/youtube/v3/docs/videos)). Custo: 1 unidade por chamada ([custo de cota](https://developers.google.com/youtube/v3/determine_quota_cost)), com até 50 ids por chamada (como o spec já usa, 3.1) | por hora só existe o que nós amostrarmos |
| Canal próprio, Analytics API | as únicas dimensões de tempo são `day` e `month`; **não há `hour`**, nem dimensão de "tempo real" ou de 48 horas. O dia é o do Pacífico ("All dates refer to the time period beginning at 12:00AM Pacific time") ([dimensões](https://developers.google.com/youtube/analytics/dimensions)) | o "tempo real" de 48 horas do Studio **não existe na API** |
| Canal próprio, Reporting API (relatórios em lote) | a única dimensão de tempo dos relatórios de canal é `date` ([relatórios de canal](https://developers.google.com/youtube/reporting/v1/reports/channel_reports)) | idem |
| O "tempo real" do Studio | a Ajuda do YouTube diz que ele "only shows estimates of potential view activity" e pode não bater com a página do vídeo ([Ajuda: como as métricas são contadas](https://support.google.com/youtube/answer/2991785?hl=en)) | mesmo se existisse na API, seria estimativa |
| De quanto em quanto tempo o contador público muda | **a página do recurso não diz nada** sobre frequência, lote ou atraso. A Ajuda diz: "It takes our systems some time to figure out which views, likes, dislikes, and subscriptions are legitimate"; "The timing of these changes varies depending on a video or channel's popularity and views"; o YouTube pode "temporarily slow down, freeze, or change your metric count"; e nas primeiras horas de um vídeo "It may take time for your metrics to appear" | **NC, a medir nas primeiras semanas** (item de aceite 140): de quanto em quanto tempo cada contador de fato anda; se as views chegam em degraus; se a resposta da API vem de cache |

**Para o canal próprio a mesma amostragem serve**, sem depender da Analytics API: os contadores públicos dos vídeos do dono são lidos pela mesma chamada, e a comparação "o meu × o deles" fica no mesmo relógio e na mesma fonte (regra de 6.1.6). O canal do dono entra como mais um canal acompanhado em `competitor_*`.

#### 4.7.2 O desenho: amostrar de hora em hora e guardar a diferença

- **Uma execução por hora, no minuto zero.** Lê views, curtidas e comentários de cada vídeo da lista com `videos.list?part=statistics&id=…`, **50 ids por chamada, juntando vídeos de canais diferentes na mesma chamada** (a chamada é por id de vídeo, não por canal; é isso que deixa a cota em dezenas de unidades por dia, 9.5).
- **A diferença** entre duas leituras seguidas do mesmo vídeo é o que entra no mapa. Cada leitura guarda o instante real (`taken_at`); o intervalo é atribuído à hora de São Paulo em que **começou**.
- **Intervalo de 1 hora como padrão** [DONO, pergunta 17]. O que mudaria: **30 minutos** dobra a cota e as linhas da curva das primeiras 72 horas (mais 0,75 MB por canal por ano) e só rende se o contador de fato andar mais de uma vez por hora, que é justamente o que não está confirmado; **2 horas** corta os dois pela metade e ainda responde à pergunta do dono (ele comparou janelas de 2 horas, "21 às 23" contra "3 às 5"), mas borra a curva de lançamento, em que a primeira hora pesa. Começar em 1 hora e decidir com a medição do item 140.
- **Para quais vídeos:** os publicados nos últimos **14 dias** (`RULES.hourlyAgeDays`), até **25 por canal** (`RULES.hourlyVideosMax`), os mais novos primeiro, de todos os canais acompanhados e dos canais do dono; ao vivo em andamento fica fora. **Por quê:** é onde há movimento. Um vídeo de seis meses ganha poucas curtidas por dia, a diferença de hora em hora é quase sempre zero, e somá-lo só acrescenta ruído e chamadas. O canal médio tem 3,8 vídeos nessa janela (98 por ano); o que mais publica teve 152 em 90 dias, cerca de 24 em 14 dias, e é para ele o teto. Acima do teto a execução **registra quantos ficaram fora** (corte silencioso é proibido).
- **A descoberta de vídeo novo continua sendo a da sincronização que já existe** (até 6 horas depois da publicação). A curva de lançamento começa na primeira leitura depois da descoberta, e a tela diz a idade do vídeo nessa leitura. Descobrir de hora em hora custa 24 unidades por canal por dia e é a pergunta 19.

#### 4.7.3 Armazenamento: o que fica, o que é descartado

**A conta do desenho ingênuo** (uma linha por vídeo e por hora, cerca de 105 B com o índice): os 50 vídeos acompanhados de um canal dariam 438.000 linhas e **cerca de 46 MB por canal por ano** (690 MB por ano com 15 canais: estoura o plano gratuito em menos de um ano, sozinho); só os vídeos de até 14 dias, 33.000 linhas e **cerca de 3,5 MB por canal por ano**, mais da metade de tudo o que a v2 previa para um canal. **Não é proposto.** O que é:

| Peça | O que guarda | Quanto tempo | Por canal e ano |
|---|---|---|---|
| **1. Curva das primeiras 72 horas**, hora a hora | os três contadores **acumulados** de cada vídeo, a cada leitura, enquanto a idade for menor que 72 horas. É a tabela `competitor_video_early` da E2 (4.3), sem mudar de forma: passa de 4 leituras por dia para 24 | fica; vai para o arquivo pela idade (9.2) | 98 vídeos × 72 = 7.060 linhas, **≈ 0,75 MB** (eram 1.200 linhas e 0,13 na v2) |
| **2. Mapa de horas do canal** | as diferenças **somadas** numa grade de 168 casas (7 dias da semana × 24 horas de São Paulo), **por mês**, separando views, curtidas e comentários, longo × Short, e duas fases do vídeo: **lançamento** (idade até 72 horas) e **depois** (do dia 4 ao 14). Quatro linhas por canal e mês, cada uma com vetores de 168 posições | fica online (é pequeno e é o que a tela lê) | 48 linhas, **≈ 0,25 MB** |
| **3. Leituras cruas, de passagem** | os contadores acumulados de cada vídeo da lista, por hora | **3 dias** (`RULES.hourlyBufferDays`): só o tempo de fechar o dia e somar no mapa; depois são apagadas | não cresce: cerca de 270 linhas por canal, 0,03 MB, em regime |
| **Descartado** | a diferença hora a hora de cada vídeo depois das 72 horas | | |

**Por que duas fases no mapa.** Sem separar, o mapa mostraria a hora em que o **canal publica**, não a hora em que o **público reage**: um canal que publica sempre às 18:00 teria o pico às 18:00 por causa do lançamento. A fase "depois" (dia 4 ao 14) é a leitura do hábito do público; a fase "lançamento" e a curva de 72 horas são a leitura da tração. A tela nunca soma as duas.

**Por que guardar também a fatia, e não só a soma.** Um vídeo que estoura ganha num dia mais curtidas que todos os outros no mês e sozinho desenharia o mapa. Por isso cada casa guarda duas coisas: a **soma** das diferenças (o volume) e a **soma das fatias** (a parte que aquela hora teve do total daquele vídeo naquele dia), em que cada vídeo e dia pesa igual. A medida M13 usa a fatia; o volume é mostrado ao lado. A fatia só é calculada para vídeo e dia com as 24 horas lidas e com movimento mínimo (4.7.6).

**Por mês, e não por semana** [DONO, pergunta 18]: por semana custa 4,3 vezes mais (cerca de 1,1 MB por canal por ano) e cada casa teria uma amostra só (uma terça às 21:00 por semana); a leitura de "nas últimas 4 semanas" continua possível somando o mês corrente e o anterior, com a tela dizendo a janela.

#### 4.7.4 DDL proposto (migration MG9)

```sql
-- 1. Leituras cruas, de passagem (apagadas depois de 3 dias)
create table if not exists public.competitor_video_hourly (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  hour_slot timestamptz not null,           -- date_trunc('hour', taken_at): duas execuções na mesma hora não duplicam
  taken_at timestamptz not null,            -- instante real da leitura
  site_id uuid not null references public.sites(id) on delete cascade,
  views bigint not null,
  likes bigint,                             -- nulo = oculto
  comments bigint,                          -- nulo = desligado
  primary key (video_id, hour_slot)
);
create index if not exists idx_cvh_slot on public.competitor_video_hourly (hour_slot);

-- 2. Mapa de horas: 4 linhas por canal e mês (formato × fase)
create table if not exists public.competitor_channel_hour_map (
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  month date not null,                      -- 1º dia do mês, data de São Paulo
  format text not null check (format in ('longo', 'short')),
  phase text not null check (phase in ('lancamento', 'depois')),   -- idade até 72 h | do dia 4 ao 14
  site_id uuid not null references public.sites(id) on delete cascade,
  -- vetores de 168 posições; índice = (dia da semana, 0 = domingo) × 24 + hora de São Paulo, + 1
  views_sum bigint[] not null,              -- soma das diferenças POSITIVAS de intervalos limpos
  likes_sum integer[] not null,
  comments_sum integer[] not null,
  views_share real[] not null,              -- soma das fatias (diferença da hora ÷ diferença do dia do mesmo vídeo)
  likes_share real[] not null,
  comments_share real[] not null,
  n_intervals integer[] not null,           -- intervalos limpos de 1 hora que caíram na casa
  -- por linha, não por casa:
  video_days_views integer not null default 0,     -- dias de vídeo completos que entraram na fatia, por contador
  video_days_likes integer not null default 0,
  video_days_comments integer not null default 0,
  videos integer not null default 0,               -- vídeos distintos que contribuíram no mês
  long_intervals integer not null default 0,       -- intervalos maiores que 1 hora (buraco): ficam FORA das casas
  long_views bigint not null default 0,            -- e a diferença que eles cobriam, para a tela dizer quanto ficou fora
  long_likes bigint not null default 0,
  long_comments bigint not null default 0,
  neg_views_n integer not null default 0,          -- leituras em que o contador DIMINUIU, e de quanto (soma, número negativo)
  neg_views_sum bigint not null default 0,
  neg_likes_n integer not null default 0,
  neg_likes_sum bigint not null default 0,
  neg_comments_n integer not null default 0,
  neg_comments_sum bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (competitor_channel_id, month, format, phase),
  check (cardinality(views_sum) = 168 and cardinality(likes_sum) = 168 and cardinality(comments_sum) = 168
     and cardinality(views_share) = 168 and cardinality(likes_share) = 168 and cardinality(comments_share) = 168
     and cardinality(n_intervals) = 168)
);

-- 3. Registro do que já foi somado: é o que torna a soma idempotente
create table if not exists public.competitor_hour_fold_log (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  day date not null,                        -- dia de São Paulo já somado no mapa
  site_id uuid not null references public.sites(id) on delete cascade,
  intervals_clean smallint not null,
  intervals_long smallint not null,
  folded_at timestamptz not null default now(),
  primary key (video_id, day)
);

alter table public.competitor_video_hourly enable row level security;
alter table public.competitor_channel_hour_map enable row level security;
alter table public.competitor_hour_fold_log enable row level security;
drop policy if exists "competitor_video_hourly_select" on public.competitor_video_hourly;
create policy "competitor_video_hourly_select" on public.competitor_video_hourly for select using (public.can_view_site(site_id));
drop policy if exists "competitor_channel_hour_map_select" on public.competitor_channel_hour_map;
create policy "competitor_channel_hour_map_select" on public.competitor_channel_hour_map for select using (public.can_view_site(site_id));
drop policy if exists "competitor_hour_fold_log_select" on public.competitor_hour_fold_log;
create policy "competitor_hour_fold_log_select" on public.competitor_hour_fold_log for select using (public.can_view_site(site_id));
```

- **`competitor_video_early` (MG2) não muda de forma**: chave `(video_id, taken_at)`, contadores acumulados. A E15 só passa a escrever nela de hora em hora, e a condição "descoberto com menos de 24 horas" da E2 continua (para vídeo descoberto tarde a curva de lançamento não existe: "descoberto tarde").
- **A soma no mapa** é uma função `competitor_hour_fold(p_day date)` (security invoker, `search_path` fixo, `execute` só para `service_role`), chamada pela execução horária para todo dia de São Paulo **fechado há pelo menos 3 horas** e ainda sem linha no registro. Numa transação só: grava a linha do registro (se já existe, não soma de novo), soma os vetores, e atualiza os contadores da linha. Depois, e só depois, a execução apaga as leituras cruas com mais de 3 dias **de dias que já têm registro**: leitura crua de dia ainda não somado nunca é apagada (se a soma parar, as leituras se acumulam e o alerta de 4.7.5 aparece; o dado não se perde em silêncio).
- **O registro de dias somados** tem 98 vídeos × 14 dias, cerca de 1.400 linhas por canal por ano (0,07 MB), e é podado pela mesma execução depois de 60 dias (o vídeo já saiu da janela), ficando em cerca de 230 linhas por canal.
- **RLS no padrão D6** (`can_view_site`): são contagens públicas, sem texto e sem pessoa. Nenhuma policy de escrita.
- **Zero × não medido:** casa com `n_intervals = 0` é "não medido naquela hora", **não** "zero curtidas naquela hora"; casa com intervalos e soma zero é zero medido. São dois estados com forma diferente na tela.
- **Remoção de canal e "apagar" de 4.5** levam as três tabelas por cascata; `competitor_channel_removal_impact` passa a contá-las. O mapa do mês **não** é recalculado quando um vídeo é apagado (as somas não guardam de qual vídeo vieram): a tela do mapa diz "inclui vídeos que saíram do YouTube ou foram apagados do painel".

#### 4.7.5 Infra: de onde sai a execução horária

- **Vercel Cron, rota `GET`.** O projeto está no plano Pro (intervalo mínimo de 1 minuto; 49 dos 100 crons do projeto em uso, lido em `apps/web/vercel.json`). Entra **uma** linha: `/api/cron/sync-youtube?mode=hourly` em `0 * * * *`. A rota já exporta `GET` (`apps/web/src/app/api/cron/sync-youtube/route.ts:20`) e já tem um modo horário (`ab-poll`, `30 * * * *`).
- **Nenhum job de `pg_cron`.** O problema registrado do projeto é o agendamento em dois lugares (a Vercel chama por `GET`, o `pg_cron` por `POST`; rota só `POST` morre calada na Vercel; rota nos dois dispara em dobro; e um job de `pg_cron` criado só no painel derrubou a produção em 05/09). Esta etapa fica **só na Vercel**, e o item de aceite 141 confere que não existe job de `pg_cron` com o nome.
- **Duração esperada:** de 2 chamadas (15 a 20 canais) a 16 (200 canais) por execução, mais uma gravação em lote e, uma vez por dia, a soma: segundos, bem abaixo do teto de 300 s da rota. O plano mede com 75 canais simulados.
- **Execução que atrasa e encavala na seguinte.** (a) **Trava:** a rota usa `withCronLock` com a chave `sync-youtube-hourly`; a segunda execução responde "já rodando" e sai. **Achado a tratar no plano:** existem duas implementações de `withCronLock`, a de `apps/web/src/lib/logger.ts` (trava **em memória**, que não vale entre instâncias da Vercel) e a de `apps/web/lib/logger.ts` (trava no banco, `cron_try_lock`); o modo horário tem de usar a do banco, e o plano confere qual a rota importa hoje. (b) **Sem duplicar:** a chave `(video_id, hour_slot)` com `on conflict do nothing` faz duas execuções na mesma hora gravarem uma leitura só. (c) **Execução pulada vira buraco, não erro escondido:** a diferença seguinte cobre duas horas e é tratada como intervalo longo (4.7.6). A Vercel não repete cron que falhou.
- **Falha em vermelho.** Chave própria em `cron_health` (`sync-youtube-hourly`), com entrada em `resolveCronName` da rota de saúde; mais de 2 horas sem sucesso é falha. A execução devolve e registra: vídeos lidos, vídeos fora do teto, intervalos longos, dias somados, leituras cruas à espera de soma. E o mapa mostra a própria cobertura ("lidas 702 de 720 horas do mês"), de modo que cron parado aparece na tela como falta, nunca como mapa vazio.
- **Cota** gravada em `youtube_quota_usage.operations`, modo `horario`.

#### 4.7.6 Limites que a tela tem de dizer, sem suavizar

1. **A diferença mostra quando o YouTube atualizou o contador, não o minuto em que a pessoa curtiu.** O YouTube valida views e curtidas antes de contar, ajusta depois, pode segurar ou congelar a contagem, e não publica de quanto em quanto tempo o número público anda (4.7.1). O que é **NC e será medido** (item 140): a proporção de intervalos de 1 hora com diferença zero seguidos de um salto (contador que anda em degraus), separada por contador e por tamanho do vídeo. Se as views andarem em degraus de várias horas, o mapa de views por hora **não é mostrado** e a tela diz por quê; o de curtidas é o mais provável de servir, e também é hipótese até a medição. Texto fixo no corpo do mapa: *"Mostra quando o contador público mudou, lido de hora em hora. O YouTube atualiza os contadores com atraso e em lotes; a hora real da curtida pode ser anterior."*
2. **Buraco:** leitura que falha faz a diferença seguinte cobrir duas horas ou mais. **Nunca é dividida ao meio.** Intervalo "limpo" é o que começa a até 5 minutos da hora cheia e dura de 50 a 70 minutos; qualquer outro é "longo": fica **fora** das casas, entra em `long_intervals` com a diferença que cobria, e a tela diz "N intervalos sem leitura horária, com X curtidas, fora do mapa". Um dia com intervalo longo não entra na fatia.
3. **Contador que diminui** (curtida retirada, limpeza de views, comentário apagado): **proposta: guardar como é, à parte.** A diferença negativa não entra na casa (uma limpeza de 5.000 views às 4:00 apagaria a casa; uma curtida retirada às 3:00 não é "menos uma reação às 3:00") e também **não vira zero em silêncio**: vai para os contadores `neg_*` da linha, com número e soma, e a tela diz "N leituras em que o contador diminuiu (soma −X), fora do mapa". Na curva das 72 horas o contador é guardado como veio, com a queda à vista. Dia com queda não entra na fatia daquele contador.
4. **Fuso.** O mapa é em **horário de São Paulo** (D5; o Brasil não tem horário de verão hoje, e a regra é "data e hora de São Paulo", não um deslocamento fixo). O público de um canal pode estar em outro fuso, ou espalhado: "21 às 23" é a hora de São Paulo em que o contador subiu, não a hora local de quem curtiu. A tela diz isso e mostra o país declarado do canal (E1) ao lado.
5. **Amostra mínima.** A fatia de um vídeo e dia só conta com as 24 horas limpas e movimento mínimo naquele dia: 200 views, 20 curtidas ou 10 comentários (cada contador com o seu) [DONO, pergunta 20]. O mapa de um canal, formato e contador é "medido" só com pelo menos **28 dias de vídeo** e **3 vídeos distintos** na janela; abaixo disso é "não medido: poucos vídeos recentes (N dias de vídeo de 28)". Para a maioria dos canais pequenos, e para o canal do dono hoje (36 views em 90 dias), **o estado real é "não medido"**, por meses.
6. **Só vê vídeos de até 14 dias.** O mapa é o ritmo do público **dos vídeos recentes**; quem assiste ao catálogo antigo não aparece.
7. **Curtidas ocultas e comentários desligados:** "não medido: oculto pelo canal", nunca zero.
8. **A regra de contagem de views** mudou em 24/08/2026; todo o mapa nasce depois dela.
9. **É cálculo nosso** sobre dado público, dito no ⓘ (III.E.4.h, seção 11.1).

#### 4.7.7 O que isso responde, e as medidas (entram na E4)

Perguntas: **em que horas o público deste canal reage** (M13, fase "depois"); **a que horas os vídeos dele ganham tração depois de publicados** (M14); **e a comparação com o canal do dono**, pela mesma amostragem.

| # | Medida | Definição exata | Janela | "Não medido" quando | Viés dito na tela |
|---|---|---|---|---|---|
| **M13** | **Horas em que o público reage** (por canal, formato e contador: views, curtidas ou comentários) | **perfil de 24 horas:** para cada hora h de São Paulo, p(h) = soma das fatias da hora h em todos os dias da semana ÷ número de dias de vídeo, na fase "depois"; a soma de p(h) nas 24 horas é 1. **Janela de pico:** as 2 horas seguidas com a maior soma de p; mostrada com "quantas vezes a média" (soma da janela ÷ 2/24). **Comparação de duas janelas** (a pergunta do dono, "21 às 23 contra 3 às 5"): razão entre as somas de p nas duas. **Mapa 7 × 24:** a mesma fatia por dia da semana, só para dia da semana com 4 dias de vídeo ou mais | o mês corrente e o anterior (padrão), ou os últimos 3, 6 ou 12 meses | menos de 28 dias de vídeo ou de 3 vídeos; contador oculto; mais de 20% das horas do período sem leitura; contador que a medição do item 140 mostrou andar em degraus | os nove limites de 4.7.6, com o primeiro no corpo da tela; "é quando o contador mudou"; canal que publica muito em um dia da semana tem aquele dia mais bem medido |
| **M14** | **Tração depois de publicar** (por canal e formato) | para cada hora k desde a publicação (1 a 72), a mediana, entre os vídeos, de views na hora k ÷ views na hora 72 (curva de 72 horas, com as leituras hora a hora); e **"metade em N horas"**: a primeira hora em que a mediana chega a 0,5. O mesmo para curtidas | publicados nos últimos 90 dias | menos de 3 vídeos com curva; vídeo descoberto com mais de 6 horas fica fora da mediana (a tela diz quantos); ao vivo e estreia fora (regra b da seção 5) | a primeira leitura depende de quando o vídeo foi descoberto; a hora de publicação do canal e o dia da semana pesam; views chegam com atraso nas primeiras horas, segundo o próprio YouTube |

M1 na idade de 1 dia (seção 5) passa a usar as leituras de hora em hora no lugar das de 6 em 6 horas, sem mudar de definição; a tolerância de "leituras vizinhas a mais de 8 h" cai para 2 h.

#### 4.7.8 Tela: o que o mockup 21 tem de considerar (seção 6.5)

1. **O mapa de horas × dias** (7 × 24) e, acima dele, o perfil de 24 horas com a janela de pico: frase-resumo no topo ("As curtidas deste canal sobem mais entre 20:00 e 22:00, 2,3 vezes a média; base: 41 dias de vídeo, 6 vídeos"), régua ou barra, cor estável.
2. **Três estados de casa, distintos por cor e por símbolo:** medido com valor, **zero medido** (caixa vazada, como no gráfico do canal próprio), **não medido** (rosa com hachura). Nunca um degradê em que "sem leitura" pareça "pouco".
3. **Caso magro, que é o caso real por meses:** canal com quase nada ("não medido: 6 dias de vídeo de 28"), com o que já existe à vista e a data provável em que passa a existir; canal do dono com 36 views em 90 dias; canal só com Shorts.
4. **O texto fixo do limite 1** no corpo, não só no ⓘ; fuso de São Paulo escrito no eixo; "N intervalos fora do mapa" e "N leituras em que o contador diminuiu" visíveis.
5. **Seletores:** contador (curtidas primeiro, que foi o pedido), formato, fase ("hábito do público: do dia 4 ao 14" × "lançamento: primeiras 72 horas", nunca somadas), período.
6. **Comparar com o meu canal:** os dois perfis de 24 horas lado a lado, cada um com a sua base, e "não comparável" quando um dos dois é não medido.
7. **A curva de 72 horas** (M14) na página do canal e na do vídeo (mockup 13, que já previa as primeiras 72 horas: passa a ser hora a hora), com a marca da hora de publicação em São Paulo.
8. **A 390 px** um mapa de 24 colunas não cabe: o mockup resolve (blocos de 2 ou 3 horas, ou o perfil de 24 horas no lugar do mapa) sem rolagem horizontal da página.
9. **Cobertura do cron à vista:** "lidas N de M horas no período".
10. Acrescenta à lista fechada de 6.1.5: "poucos vídeos recentes (N dias de vídeo de 28)", "sem leitura horária nesta hora", "o contador do YouTube anda em degraus: mapa de views por hora não mostrado", "a leitura por hora começou em dd/mm".

## 5. Medidas derivadas (etapa E4): contas fixas sobre o que a Parte 1 grava

Regras comuns. (a) Toda medida devolve `{ estado: 'medido', valor, n, janela }` ou `{ estado: 'nao_medido', motivo, desde? }`; nunca nulo solto, nunca 0 por falta (o sistema "falha em verde"; seção 8). (b) Longos e Shorts nunca se misturam; ao vivo e estreia (`was_live`) ficam fora das medianas de M1, M2 e M7 e a tela diz quantos saíram. (c) Mínimo de amostra: `RULES.weakBase` (3) para mediana de canal, salvo dito. (d) Limiar de "igual": ±10%, o mesmo de "praticamente igual" [DONO]. (e) Toda medida é **cálculo nosso sobre dado público**, e o ⓘ diz isso (política III.E.4.h, seção 11.1). (f) Janela que cruza 24/08/2026 leva a marca "a contagem de views do YouTube mudou neste período". (g) Vídeo fora do ar e mantido para análise (4.5) continua nas medidas do tempo em que esteve no ar, e a tela diz quantos são. (h) Série que foi para o arquivo (9.2) responde "não medido: arquivado, no arquivo desde dd/mm", nunca buraco nem zero. As funções são puras, em `lib/medidas/`, com teste de borda para cada limiar.

| # | Medida | Definição exata | Janela | "Não medido" quando | Viés dito na tela |
|---|---|---|---|---|---|
| **M1** | **Views na idade N** (N = 1, 7, 30 dias) | views do vídeo no instante `publicação + N dias`, por interpolação linear entre as duas leituras vizinhas (`viewsAtAge`, `series.ts`). N = 1 usa as leituras das primeiras horas; N = 7 e 30, a série diária. Do canal: mediana entre os vídeos do formato publicados na janela | vídeo: fixa na idade; canal: publicados nos últimos 90 dias | vídeo publicado antes de 03/10/2026 ("a contagem diária começou em 03/10"); descoberto com mais de 24 h ("descoberto tarde"); leituras vizinhas a mais de 36 h (8 h para N = 1); idade menor que N ("fecha em dd/mm"); canal com menos de 3 vídeos medidos | interpolar entre leituras espaçadas subestima a subida inicial; o horário de publicação e o fim de semana pesam mais em N = 1 e 7 |
| **M2** | **Curva por idade** | para as idades 1, 2, 3, 5, 7, 14, 21 e 30 dias (e 60, 90 com a série diária ou semanal), a mediana de M1 entre os vídeos do canal medidos naquela idade; e a versão relativa: fração de V30 já alcançada em cada idade | publicados nos últimos 180 dias | ponto com menos de 3 vídeos (cada ponto escreve o seu `n`) | os pontos de idade alta só têm os vídeos mais velhos: a curva não é de um mesmo grupo |
| **M3** | **Direção do canal** (cada canal contra ele mesmo) | três leituras, mostradas com o nome: **(a) do canal inteiro:** views totais ganhas nos últimos 28 dias ÷ nos 28 anteriores (`competitor_channel_snapshots.view_count`); **(b) dos vídeos novos, acumulada:** mediana das views atuais dos longos publicados nos últimos 90 dias ÷ a dos 90 anteriores (a da Parte D do mockup); **(c) dos vídeos novos, justa:** o mesmo com V30 (M1) no lugar das views atuais. ▲ se ≥ +10%, ▼ se ≤ −10%, ＝ no meio | 28 × 28 dias (a); 90 × 90 dias (b, c) | (a) menos de 56 dias de registro, ou dia sem registro na borda; (b) menos de 3 longos em algum dos períodos; (c) idem com V30: **só existe a partir de abril de 2027** (180 dias de série desde 03/10/2026) | (a) inclui Shorts e vídeos apagados; antes de 19/10/2026 a janela cruza a mudança de contagem; (b) "descer pode ser só idade: os vídeos mais antigos tiveram mais tempo"; subir apesar disso é sinal forte; (c) sem viés de idade |
| **M4** | **Taxa de acerto** | fração dos longos publicados nos últimos 90 dias, com 7 dias ou mais, cujo múltiplo (motor atual, `multiplier.ts`) é ≥ 2 (`RULES.outlierMin`); ao lado, a de fracasso: múltiplo ≤ 0,5 | 90 dias | menos de 5 vídeos com múltiplo de base não fraca (`RULES.medianMinN`) | o múltiplo é contra a mediana do próprio canal: mede regularidade, não tamanho; não compara canais em valor absoluto. Sempre "3 de 12"; percentual só com 10 ou mais |
| **M5** | **O que mudou antes e depois de subir** | (i) efeito de troca: o do motor atual (`effect.ts`: 7 dias depois contra até 7 antes, comparado com os outros vídeos do canal), só para título e miniatura; (ii) **subida**: primeiro dia em que a taxa dos 7 dias seguintes é ≥ 2× a dos 7 anteriores **e** o ganho nesses 7 dias é ≥ 1.000 views [DONO]; para cada subida, a lista de todas as mudanças registradas nos 14 dias anteriores (título, miniatura, descrição, tags, categoria, duração, capítulos, entrada em playlist) | 14 dias antes da subida; 7 depois da troca | sem série diária nos 14 dias (vídeo em faixa semanal: "série semanal") ou antes de 03/10 | lista coincidências, **não afirma causa**; não vê o que acontece fora do YouTube nem o que o YouTube recomenda; mudanças simultâneas não se separam |
| **M6** | **Ritmo e regularidade** | por formato: publicações por semana em 13 semanas (existe, `cadence`); **intervalo mediano** entre publicações; **semanas com publicação** ("11 de 13"); **maior buraco** em 26 semanas, em dias | 13 e 26 semanas | menos de 4 publicações na janela (3 intervalos); canal ainda buscando vídeos ("ritmo parcial", já existe) | vídeo apagado some da conta nos dados anteriores à E1; estreia conta pela data de publicação |
| **M7** | **Engajamento por view** | por vídeo: (curtidas + comentários) ÷ views **na idade de 30 dias** (leitura do dia 30); sem ela, sobre o total de hoje para vídeos de até 90 dias (existe, `engagementOf`), rotulado "total de hoje". Do canal: mediana. Curtidas e comentários também separados | idade 30 dias; ou 90 dias | curtidas ocultas **e** comentários desligados; com só um ausente, mostra o outro, rotulado ("só curtidas: comentários desligados"); vídeo com menos de 100 views | a taxa cai com a idade (views tardias engajam menos); por isso a idade fixa |
| **M8** | **Estado do canal** | **ativo**; **parado**: dias desde a última publicação > maior entre 28 e 4× o intervalo mediano (M6); **em queda sustentada**: M3(a) ≤ −10% em três janelas de 28 dias seguidas; **fora do ar**: `channels.list` sem o canal em duas leituras seguidas (`missing_since`) | 112 dias para a queda | queda: menos de 112 dias de registro sem cruzar 24/08/2026 (**primeira leitura limpa em 14/12/2026**); parado: M6 não medido usa só o piso de 28 dias | canal sazonal parece parado; inscritos não entram (arredondados a 3 algarismos) |
| **M9** | **Cauda do vídeo** (pico × perene) | (views de hoje − V30) ÷ views de hoje, para vídeos com 90 dias ou mais e V30 medido; e "ainda rende": ganho dos últimos 28 dias ÷ V30 | idade ≥ 90 dias | sem V30 (todo vídeo publicado antes de 03/10/2026); série semanal com buraco | só existe para vídeos nascidos dentro da série: **a partir de janeiro de 2027** |
| **M10** | **Pico sem cauda** (leitura, **não número**; é um indício) | o vídeo recebe a leitura quando valem as **três** condições, cada uma contra o próprio canal e o mesmo formato: **(i) muitas views cedo:** V30 (M1) ≥ 2× a mediana de V30 do canal (`RULES.outlierMin`); **(ii) quase nada depois:** cauda (M9) ≤ metade da mediana de cauda do canal **e** "ainda rende" (M9) ≤ 2% [DONO]; **(iii) pouca reação:** engajamento por view na idade 30 (M7) ≤ metade da mediana do canal [DONO]. Resultado: `pico_sem_cauda`, `nao_e_o_caso`, ou não medido. Não há nota nem percentual: a tela mostra as três condições com os três números | idade ≥ 90 dias | falta V30 (todo vídeo publicado antes de 03/10/2026); V30 < 1.000 views; canal com menos de 5 vídeos do formato com V30 e 90 dias (`RULES.medianMinN`); curtidas ocultas **e** comentários desligados ("sem reação pública para comparar": a leitura **não** é dada só com duas condições); ao vivo ou estreia | o texto obrigatório abaixo; vídeo de notícia ou de data marcada tem pico sem cauda por natureza; vale para longos e Shorts separados, e Shorts quase sempre têm cauda curta (o limiar é relativo ao canal por isso) |

**Texto obrigatório de M10, em toda tela em que a leitura aparecer** (no corpo, não só no ⓘ): *"Indício, não medição. Este vídeo teve muitas views nos primeiros 30 dias, quase nenhuma depois, e pouca reação do público (curtidas e comentários). Isso costuma acontecer quando o YouTube para de recomendar um vídeo; essa é uma hipótese nossa sobre como a recomendação funciona, não um dado. O YouTube não mostra a ninguém de fora quanto tempo as pessoas assistiram ao vídeo de outro canal."* Nome de tela proposto, em português simples: **"Estourou e parou"**; alternativa mais cautelosa: **"Muitas views, pouco sinal de que agradou"** (o nome fecha no mockup 14; "pico sem cauda" é o nome interno). A palavra "retenção" não aparece. O oposto ("segue rendendo": cauda ≥ 2× a mediana do canal) é só o valor alto de M9, sem leitura própria. Os limiares são palpite inicial: o plano os confere contra os vídeos reais assim que houver 20 com V30 e 90 dias, e a mudança é um número em `rules.ts`.

**M1 gravada nas idades 1, 7 e 30 (regra nova da v2).** M1 era só cálculo na leitura; com o arquivamento da série (9.2) o cálculo deixaria de ser possível para vídeo antigo, e M3(c), M9 e M10 dependem de V30. Por isso a marca é **gravada uma vez, quando a idade fecha**, numa tabela pequena que nunca sai do banco online:

```sql
create table if not exists public.competitor_video_marks (        -- migration MG4
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  age_days smallint not null check (age_days in (1, 7, 30)),
  site_id uuid not null references public.sites(id) on delete cascade,
  views bigint not null,              -- interpolado, como M1
  likes bigint,                       -- nulo = oculto ou não medido
  comments bigint,                    -- nulo = desligado ou não medido
  gap_hours numeric not null,         -- distância entre as duas leituras usadas (a tela mostra)
  computed_at timestamptz not null default now(),
  primary key (video_id, age_days)
);
alter table public.competitor_video_marks enable row level security;
drop policy if exists "competitor_video_marks_select" on public.competitor_video_marks;
create policy "competitor_video_marks_select" on public.competitor_video_marks
  for select using (public.can_view_site(site_id));
```

Sem linha = não medido, com o motivo de M1 (a marca **não** é gravada com palpite quando as leituras vizinhas estão longe demais). Cerca de 300 linhas por canal por ano (0,03 MB). A função pura de M1 continua sendo a única conta; a tabela é o resultado dela guardado, e um teste afirma que a marca gravada é igual ao cálculo sobre a série enquanto a série existir. **O export de 9.2 recusa arquivar a série de um vídeo cuja idade 30 já fechou e que não tem marca nem motivo registrado.**

Datas em que cada medida passa a existir (a tela calcula; aqui, a ordem de grandeza): M1 N = 7 desde 10/10/2026 e N = 30 desde 02/11/2026 para os 39 vídeos publicados desde 03/10; N = 1 só para vídeos publicados depois do deploy da E2; M3(a) já (com a marca de contagem até 19/10); M3(b) já; M6 já; M4 já; M8 "parado" já, "queda" em 14/12/2026; M2 conforme M1; M9 em janeiro de 2027; M10 a partir de janeiro de 2027 para o primeiro vídeo e, no canal mediano (cerca de 5 longos a cada 90 dias), só por volta de abril de 2027, quando houver 5 vídeos com 90 dias; M3(c) em abril de 2027. Divergência registrada: a `REVISAO.md` diz que a direção "14 dias contra 14" existe em 17/10; a conta dá 31/10 (28 dias de série). Este spec usa M3(a), que já tem 133 dias de registro.

Nenhuma medida depende de dado que saiu da triagem (conferido linha a linha: usam contagens, datas, formato, versões e, em M5, playlists só se a E3 existir; sem ela, a linha "entrada em playlist" não aparece).

## 6. Parte 2: telas (etapa E5)

Regra do dono: **mockup antes de código, sempre com a skill `frontend-design`, e ele aprova o mockup de cada tela.** Este spec não desenha; lista o que cada mockup tem de considerar. Preferências dele, que valem como critério de reprovação: frase-resumo no topo de cada bloco; régua ou barra; cor estável, inclusive a de "não medido" (rosa com hachura, spec de telas 19.2); método no ⓘ; bloco monocromático ou em prosa é reprovado; nenhum `color-mix()`.

### 6.1 O que todo mockup desta fase considera (do inventário, seção 6)

1. **A tela nasce quase vazia.** Histórico de campo desde o deploy da E1; primeiras horas desde a E2; V30 de 39 vídeos em novembro. O estado vazio é o estado real por meses: é desenhado primeiro, com a data em que cada número passa a existir.
2. **Valor de agora × série.** O total de hoje (sempre existe) e o ponto da série (pode não existir) são coisas diferentes e têm rótulos diferentes.
3. **Vídeo fora da série diária:** "série semanal" é um estado com forma própria (ponto por semana, sem veredito de efeito), não um gráfico diário com buracos.
4. **Contagem oculta ou arredondada:** inscritos a 3 algarismos ("≈ 0, dentro do arredondamento"); inscritos ocultos; curtidas ocultas; comentários desligados.
5. **"Não medido" com motivo**, da lista fechada: contagem começou em 03/10; histórico de campo desde dd/mm; descoberto tarde; fecha em dd/mm; menos de N vídeos; série semanal; oculto pelo canal; não veio mais do YouTube; o YouTube não mostra isso de canal de terceiro; arquivado (no arquivo desde dd/mm); não coletada (a retenção do vídeo próprio antes da E8, ou vídeo com poucas views para o YouTube devolver curva).
6. **Comparável com o canal próprio ou não.** Do concorrente só existe o público. Views na idade N, ritmo, engajamento e direção são comparáveis **desde que do mesmo relógio**: o canal próprio entra pela série pública dele em `competitor_*` quando existir, nunca pelo diário privado (dia do YouTube, outra fonte). Retenção, impressões, taxa de clique, tráfego: só no cartão "Só o seu canal mede".
7. **Mudança de contagem de 24/08/2026:** linha de corte em toda série longa.
8. **1440 e 390 px, tema escuro e claro**, com a página no tamanho cheio e no magro.

### 6.2 Telas existentes: o que muda

| Tela | Já desenhado | Passa a poder mostrar | O mockup precisa considerar |
|---|---|---|---|
| **Comparar canais** (`C/_comparar/`) | Parte D: base de 90 dias × todos; direção; primeiros 7 e 30 dias; "Longos acompanhados" fora do ranking; Leitura rápida por direção | M3 nas três leituras; M1 com N = 1; M4; M7 na idade 30; M8 no cartão de cada lado | qual das três direções é a principal (proposta: (a) hoje, (c) quando existir) e como as outras aparecem sem virar três vereditos; canal de nichos diferentes; lado sem canal próprio |
| **Seletor de canal da comparação** | C1: combobox com busca | busca também por handle e país; "sem vídeos", "inscritos ocultos", "fora do ar" como pastilha | 75 ou mais canais; canal fora do ar não some da lista |
| **Lista de Canais e painel** | C2: descrição à parte da conta principal, com hábito | coluna Direção (M3a) e estado (M8); filtro "parados" e "em queda" | a conta "Trocas" segue título + miniatura; mudanças de campo novas ficam fora dela; a decisão D16 (cortar o painel) conflita com C2: o dono escolhe |
| **Página do canal** | não | aba ou bloco "Lançamentos" (6.3); cabeçalho com direção e estado; M6 completo; M4 | o cabeçalho já tem seis células: o que sai para entrar direção |
| **Histórico do vídeo** | não | curva do vídeo contra M2 do canal; primeiras 72 horas; marcas de mudança de campo no eixo; subida marcada com a lista de M5; "série semanal"; "sumiu em dd/mm" | o gráfico já tem raias de título e miniatura: quantas raias cabem antes de virar ruído |
| **Trocas / Mudanças** | não | filtro "outras mudanças" (tags, categoria, duração, formato), separado | não inflar a contagem da aba |
| **Outliers** | não | ordenar por V7 ou V30 na mesma idade, além do múltiplo; selo "ao vivo ou estreia" | quase tudo "não medido" até novembro: o padrão continua sendo o múltiplo |
| **Insights** | não | "quem sobe e quem desce no nicho" (régua de direção da Parte D, com todos os canais) | posição escrita, nunca percentil; a régua ordena, não julga |
| **Histórico do vídeo e Outliers: leitura "Estourou e parou" (M10)** | não | a leitura com as três condições e os três números, e o texto obrigatório da seção 5 no corpo | não pode parecer nota nem veredito: é indício; nunca a palavra "retenção"; quase tudo "não medido" até 2027; como aparece quando só duas condições valem (não aparece: mostra "não é o caso" com os números) |
| **Vídeo fora do ar** (em qualquer tela) | não | pastilha "saiu do YouTube em dd/mm" e, se respondido, "mantido para análise" | não some das listas; a série termina na data; o link para o YouTube deixa de existir |
| **Página do vídeo próprio: seção "Retenção"** (`C/_proprio/`) | sim, com **exemplo** (`video.html?caso=cheio`); o estado real de hoje é "não coletada" | a curva real (7.2): frase "metade das pessoas já saiu aos m:ss", maiores saídas marcadas, trechos revistos, comparação com vídeos de duração parecida | refazer **com o dado real** depois da primeira coleta: vídeo com poucas views (o YouTube devolve curva vazia ou serrilhada), Short (curva passa de 100%), vídeo de 2015, e a data da leitura sempre escrita |

| **Páginas do vídeo e do canal próprios: origem das views** (`C/_proprio/`) | não (hoje estão em "O que ainda não é medido") | 7.3: de onde vêm as views, o que pesquisaram e de que sites vieram, em que aparelho, de que país, inscritos e não inscritos; impressões por origem | a parte "omitido pelo YouTube" (a soma fica abaixo do total); canal com poucas views (quase tudo omitido); termos e sites **só para quem edita**; período longo (2015 a hoje) e a marca de mudança de contagem; país por mês na parte antiga, se a API não der por dia; o cartão "Só o seu canal mede" ganha linhas |

### 6.3 Telas novas que se justificam (três: duas dentro da página do canal e a fila do que saiu do YouTube)

1. **Lançamentos:** as curvas dos primeiros 30 dias dos vídeos recentes do canal, alinhadas pela idade, sobre a mediana do canal (M2). Responde P2 e P7 de relance ("este saiu acima do normal já no dia 2"). Sem ela, M1 e M2 só existem como número em tabela.
2. **Linha do tempo do canal:** um eixo de tempo com as views ganhas por dia do canal (M3a) e, sobre ele, publicações, mudanças de campo, trocas e playlists. Responde P3 ("o que ele mudou antes de subir") no nível do canal. Depende da E1 (e da E3 para playlists).
3. **Fila "Saíram do YouTube"** (4.5): uma aba do Observatório com contador. Lista os itens sem resposta, com o que se sabe de cada um e os dois botões; abaixo, os já respondidos ("mantidos", "apagados": só id e datas). O mockup considera: fila vazia (o estado normal); um canal inteiro fora do ar como um item só; a confirmação escrita de "apagar" com a contagem do que some; o estado "apagando" (miniaturas ou arquivo pendentes); "voltou ao ar"; e a frase fixa "o YouTube não diz o motivo".

Fase de manutenção, só registrada para o desenho não fechar a porta: **"Ver antigo"** (9.2), um botão nas telas de série que pede ao arquivo o período que já saiu do banco online.

Nenhuma tela para playlists sozinha.

### 6.4 Defeito em produção: o contêiner da comparação para no meio do monitor (T0)

**Sintoma relatado pelo dono:** na tela Comparar, o conteúdo é cortado em cerca de 925 px numa janela de cerca de 1.060 px; o documento mede 1.205 px de altura (1.931 de largura) e abaixo do corte o fundo é preto. **Hipótese não verificada:** o documento rola além do `main` da casca do CMS. Já descartado: o foco do `h1` usa `preventScroll`. **Exigência:** reproduzir em navegador (1440 × 1060 e 390 px, tema escuro e claro, página cheia e magra), medir `document.scrollingElement`, o `main` da casca e o contêiner da tela, e só então consertar; o conserto leva um teste e2e que falha no estado atual. Não depende de mockup nem de dado. Por decisão do dono de 12/10 os ajustes da A3 estão "só em planejamento": este item entra no plano e executa quando ele liberar (pergunta 4).

### 6.5 Etapa E13: fazer e validar os mockups (entre a coleta e o código de tela)

Pedido do dono (12/10): "preciso que você adicione uma etapa do spec para fazermos e validarmos o mockup". É uma etapa com entrega e itens de aceite próprios (98 a 106).

**(a) Quem faz.** Sempre a skill `frontend-design`, dentro da identidade já aprovada do Observatório (os tokens de `chrome.css` e `tokens-telas.css`, a rodada `2026-10-07-pagina-canal/` como referência). Nenhum mockup nasce fora dela, e nenhum usa `color-mix()`. Cada rodada entrega os arquivos em `docs/superpowers/mockups/<data>-<tema>/`, com `index.html`, `REVISAO.md` e as capturas em `shots/`.

**(b) A lista, na ordem de aprovação.**

*Já existem e aguardam aprovação* (`mockups/2026-10-12-a4-proprio-e-ajustes/`, itens 1 a 9 da `REVISAO.md`):

| # | Mockup | Abrir |
|---|---|---|
| 1 | Página do canal próprio com dado (cheio, magro, sem dado, canal novo) | `canal.html` |
| 2 | Gráfico: zero medido como caixa vazada e "dia anterior / dia seguinte" a 390 px | `canal.html?caso=cheio` |
| 3 | Página do vídeo próprio com dado | `video.html` |
| 4 | Taxa de clique com intervalo | `canal.html`, `video.html`, `comparar-so-seu-canal.html` |
| 5 | % assistido | `canal.html?caso=cheio&aba=retencao`, `video.html` |
| 6 | Retenção (curva de **exemplo**; estado real "não coletada") | `video.html?caso=cheio` |
| 7 | Seletor de canal com busca | `c1-seletor.html` |
| 8 | Troca de descrição na lista e no painel | `c2-trocas.html` |
| 9 | Comparar canais por base e direção | `comparar-direcao.html` |

*Faltam* (a ordem segue o que destrava código primeiro e onde o dado novo aparece antes):

| # | Mockup | Depende de dado de |
|---|---|---|
| 10 | **Fila "Saíram do YouTube"**, com a confirmação escrita do dono (6.3, item 3) | nada (a E1 enche a fila no segundo dia) |
| 11 | **Retenção do vídeo próprio com dado real** (refaz o item 6) | primeira leva da E8 |
| 12 | **Canal e vídeo próprios: origem de tráfego, termos de pesquisa, aparelho, país, inscritos** | retroação da E11 |
| 13 | **Histórico do vídeo de concorrente:** curva por idade (M2), **primeiras 72 horas**, marcas de mudança de campo, subida (M5), "série semanal", "saiu do YouTube" | E1 e E2 (uma semana de dado) |
| 14 | **A leitura M10** ("Estourou e parou"; nome alternativo a pesar no mockup: "Muitas views, pouco sinal de que agradou"), com o texto obrigatório | só exemplo até 2027: o mockup diz isso |
| 15 | **Página do canal de concorrente:** cabeçalho com direção e estado, Lançamentos, Linha do tempo | E1, E2 e E4 |
| 16 | **Lista de Canais:** direção, estado, filtros "parados" e "em queda", pastilha "fora do ar" | E4 |
| 17 | **Comparar (estados novos), Outliers e Insights:** M3(a), M4 e M8; ordenação por V7 e V30; selo "ao vivo ou estreia"; régua de direção do nicho | E4 |
| 18 | **O aviso de "banco chegando ao limite"** (9.2): verde, amarelo, vermelho, "sem leitura hoje", lotes exportados e não confirmados | E10 |
| 19 | **"Ver antigo" e o estado "arquivado": só esboço**, por serem da fase de manutenção; serve para as telas de série não fecharem a porta | nada |
| 20 | **Comentários de destaque do vídeo de concorrente** (emenda v2.1; o que considerar: 4.6.9): a amostra dita no topo, os três retratos por idade, a resposta do criador, os quatro estados sem comentário, texto longo, ofensivo, em outro idioma e com emoji, e os comentários que saíram do YouTube dentro da fila do mockup 10. **Fica logo depois do 13**, de que é uma seção; só é desenhado depois das respostas às perguntas 9 e 10 | E14 (uma semana de dado: retratos de 1 e 7 dias) |
| 21 | **Ritmo por hora** (emenda v2.1; o que considerar: 4.7.8): o mapa de horas × dias, o perfil de 24 horas com a janela de pico, a comparação com o canal do dono, a curva de 72 horas; **caso magro: canal com quase nada** ("não medido: poucos vídeos recentes"), que é o caso real por meses. Só é levado ao dono depois da medição do item 140, que diz quais contadores podem ser mostrados | E15 (30 dias de leitura para o caso cheio com dado real; antes disso, exemplo marcado) |

**(c) O que cada mockup tem de mostrar para ser validável.** O **caso cheio e o caso magro com os números reais dos canais do dono** (os dois canais próprios e os concorrentes cadastrados); o **estado sem dado**; cada **"não medido" com o motivo** da lista fechada de 6.1.5; **1440 e 390 px**; **tema claro e escuro**; e, na tela e na `REVISAO.md`, **o que é dado real e o que é exemplo** (todo número de exemplo leva a marca "exemplo"). Mockup de dado que ainda não existe (M10, "Ver antigo") diz isso no topo. Valem os critérios de reprovação do começo desta seção (frase-resumo, régua ou barra, cor estável, método no ⓘ).

**(d) O rito de validação: dois crivos, o do revisor e o do dono.** Pedido do dono (12/10): "o frontend-design tem que ser cobrado. Quero um subagente senior frontend UX engineer que foca principalmente na experiência do usuário e em garantir que as cores estejam bem representadas e destacando a informação necessária". O revisor é o agente `revisor-ux-senior` (`~/.claude/agents/revisor-ux-senior.md`): não desenha nem edita, cobra, mede e devolve veredito.

| Passo | Quem | O que acontece |
|---|---|---|
| 1 | skill `frontend-design` | desenha o mockup, com tudo de (c) |
| 2 | `revisor-ux-senior` | abre o mockup **em navegador** (sobre `file://`), a 1440 e 390 px, nos dois temas, em cada estado; tira capturas, mede, e dá **veredito por tela**: *pronto para o dono*, *volta para ajuste* ou *reprovado*. Cada achado tem tela e estado, a evidência (medida, captura), a severidade (**bloqueia**, **corrige** ou **sugestão**) e o conserto em uma frase |
| 3 | skill `frontend-design` | corrige todo achado "bloqueia" e "corrige" |
| 4 | `revisor-ux-senior` | confere a correção e fecha cada achado, ou devolve de novo |
| 5 | **o dono** | só então abre o mockup e responde uma de três coisas: **aprova**, **pede ajuste** ou **reprova**. Ajuste pedido volta ao passo 1 e passa de novo pelo revisor |

- **O que o revisor julga** (os sete critérios da definição dele, nesta ordem): se a tela responde à pergunta de quem abre **no primeiro olhar** (em 3 segundos, sem rolar); se **a cor carrega informação**, uma cor com um significado só em toda tela, o que importa com o maior contraste e o secundário recuando, e cada estado (medido, zero medido, não medido, erro, subindo, descendo, indisponível) distinto por cor **e** por forma ou símbolo, legível em escala de cinza; hierarquia e densidade; texto de interface (nenhuma frase afirma mais do que o dado sustenta); estados e bordas (nulo nunca como zero); uso real (teclado, alvo de toque de 44 px, 390 px sem rolagem horizontal, os dois temas, movimento reduzido); coerência com o que já foi aprovado. As preferências registradas do dono valem como requisito.
- **A revisão fica em arquivo ao lado do mockup** (`REVISAO-UX.md` na pasta da rodada), com, por tela: a pergunta do usuário, o veredito, os achados por severidade e a **tabela de medidas**: contraste de texto e de elemento gráfico nos **dois temas**, com o número (mínimo de 4,5:1 para texto normal e 3:1 para texto grande e elemento gráfico), **alvos de toque**, e larguras e alturas a **390 px**. E, escrito, **o que o revisor não conseguiu verificar** (leitor de tela, um navegador específico), em vez de omitir.
- **Nenhum mockup vai ao dono com achado "bloqueia" ou "corrige" aberto.** "Sugestão" pode ir aberta, listada para ele.
- **Os nove mockups que já existem passam por esse crivo antes de serem levados à aprovação.**
- **Um por vez para o dono:** o mockup seguinte só é apresentado depois da resposta ao anterior (os que não dependem um do outro podem ser *feitos* e *revisados* em paralelo, não *aprovados* em lote). **Nenhuma tela vira código sem o mockup correspondente aprovado.** Cada resposta fica no ledger da fase com a data, o número do mockup e o veredito.
- **O mesmo revisor confere a tela implementada contra o mockup aprovado antes de a tela ir a produção** (em navegador, nos mesmos tamanhos e temas); divergência não declarada é achado "corrige".
- Custo: o revisor roda em Sonnet (é a definição dele) e é o único que abre navegador, como manda a regra de economia do projeto; as capturas ficam em arquivo.

**(e) O que não espera mockup** e pode ser planejado e executado antes: toda a coleta (E12, E1, E2, E3, E8 e E11, sem as telas), as medidas como modelo puro (E4), a dieta (E6), o export e o sinal no retorno do cron (E10), a parte de servidor da fila (E9), o Cowork (E7) e o conserto T0.

## 7. Canal próprio: dieta do diário (E6), curva de retenção (E8) e origem das views em tabelas (E11)

### 7.1 Dieta do diário (etapa E6)

**O que é, em uma frase.** Hoje o banco guarda uma linha por vídeo por dia desde a publicação, mesmo nos dias sem nenhuma view; a dieta passa a guardar só os dias em que houve alguma atividade, mais uma tabela pequena que registra quais dias foram coletados, de modo que nada se perde e "zero medido" continua diferente de "não medido". O "lixo" é a forma de guardar (97,5% de linhas vazias), não a informação: a mesma informação cabe em menos de 1 MB.

**Problema.** `yt_own_video_daily` grava uma linha por vídeo e dia desde a publicação, e 97,5% delas são um dia sem nada (fato 11). O volume cresce com vídeos × dias de vida, para sempre.

**Desenho.**

- **D8. A tabela guarda só dia com atividade.** Atividade = pelo menos uma destas colunas diferente de zero (negativo conta): `views`, `engaged_views`, `watch_time_minutes`, `likes`, `comments`, `shares`, `subscribers_gained`, `subscribers_lost`, `card_impressions`. Conferido: nenhuma linha sem atividade tem `avg_view_*` ou `card_click_rate` preenchido; as 22 linhas com views 0 e outra atividade **ficam**.
- **D9. Uma tabela de cobertura diz "o dia D foi coletado para o vídeo V"**, por intervalo (não por dia: uma linha por dia teria as mesmas 96.892 linhas):

```sql
create table if not exists public.yt_own_video_coverage (
  youtube_video_id text not null,
  metric_set text not null check (metric_set in ('base', 'estendidas',     -- METRICAS_BASE × METRICAS_ESTENDIDAS (analytics-diario.ts:12-17)
    'trafego', 'dispositivo', 'pais', 'inscrito', 'detalhe', 'alcance_dim')),   -- conjuntos da E11 (7.3); já entram no check para não haver segunda migration
  covered_from date not null,          -- dia do YouTube, inclusive
  covered_to date not null,            -- idem; o último dia que a fonte DEVOLVEU, não "hoje"
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  source text not null default 'analytics_api' check (source in ('analytics_api', 'reporting_api')),
  collected_at timestamptz not null default now(),
  primary key (youtube_video_id, metric_set, covered_from),
  check (covered_to >= covered_from)
);
create index if not exists idx_yt_own_video_coverage_channel on public.yt_own_video_coverage (channel_id, covered_to);
alter table public.yt_own_video_coverage enable row level security;
drop policy if exists "yt_own_video_coverage_select" on public.yt_own_video_coverage;
create policy "yt_own_video_coverage_select" on public.yt_own_video_coverage
  for select using (public.can_edit_site(site_id));
```

- **D10. Leitura:** para uma métrica do conjunto S, o dia D do vídeo V é **zero medido** se existe intervalo de (V, S) que contém D e não há linha; é **o valor da linha** se há linha (coluna nula na linha continua "não medido" daquela métrica); é **não medido** se nenhum intervalo contém D. Dia que a fonte não devolveu dentro de uma janela pedida **parte o intervalo** (hoje não há nenhum caso; a forma existe para não mentir se houver). Há dois conjuntos porque as métricas estendidas podem ser recusadas pela API (`estendidas: 'recusadas'`): sem isso, um dia sem linha diria "0 impressões de cartão" de um dia em que elas nem foram pedidas.
- **D11. Escrita atômica.** Função `yt_own_daily_apply(p_video text, p_ids jsonb, p_rows jsonb, p_days_returned date[], p_sets text[])`, no molde de `yt_own_reach_apply` (`execute` só para `service_role`): na mesma transação (1) grava as linhas com atividade, sem deixar valor ausente no envio apagar valor gravado; (2) **apaga** a linha de um dia devolvido que agora não tem atividade (o YouTube revisa os últimos dias); (3) estende ou parte os intervalos de cobertura com os dias devolvidos, fundindo vizinhos.
- **D12. Efeito na coleta** (`coleta/diario-step.ts`): o "último dia gravado" de cada vídeo (`:105-110`, hoje `max(day_pt)` do diário) passa a ser `max(covered_to)` do conjunto `base`. Sem isso, num canal parado a janela recomeçaria no último dia **com view**, anos atrás, todo dia. O envio em lotes de mesma assinatura (`:186-212`) é substituído pela função.
- **D13. Efeito nos leitores da A4** (`lib/proprio/`): a mudança fica **inteira dentro de `ler.ts`**. `lerDiario` lê também os intervalos da janela e **devolve as mesmas `DiarioLinha`**, materializando `views: 0` para dia coberto sem linha; `ultimoDia` passa a ser o `max(covered_to)`. `tipos.ts`, `vpd.ts`, `dias.ts` e os modelos de tela não mudam: para eles "zero é linha, falta de linha é não medido" continua verdade, agora na fronteira do leitor. O leitor tolera os dois estados do banco (antes e depois da dieta), o que permite publicar o código antes de apagar qualquer coisa. A Tarefa 2 da A4 (`avg_view_percentage`, `avg_view_duration_seconds`) não é afetada: esses valores só existem em dia com view.
- **D14. Outros pontos tocados:** `youtube_channel_removal_impact` recriada com a tabela nova em `serie_coletada`, e `youtube_channel_remove` conferida (a cobertura tem `on delete restrict` no canal, como o diário); a semente e2e (`e2e/fixtures/observatorio-seed.ts:292`, `:412`) passa a semear cobertura e a limpar a tabela nova; `database.types.ts` regenerado.

**Migração dos dados existentes: destrutiva, só com o dono, em quatro passos separados por conferência.**

| Passo | O que | Reversível? |
|---|---|---|
| **P1** (migration aditiva) | cria `yt_own_video_coverage` e `yt_own_daily_apply`; preenche a cobertura a partir das linhas existentes (ilhas de dias seguidos por vídeo, um conjunto para `views is not null`, outro para `engaged_views is not null`); recria a função de impacto. **Não apaga nada** | sim (`drop table`) |
| **P2** (código) | leitor tolerante (D13) e coleta pela função (D11, D12) em produção; observar **3 execuções** do cron das 12:00 UTC | sim (reverter o commit) |
| **P3** (com o dono, fora da janela 11:30 a 13:00 UTC) | (i) cópia fora do banco: `\copy (select * from yt_own_video_daily order by youtube_video_id, day_pt) to 'yt_own_video_daily-AAAAMMDD.csv' csv header`, guardada pelo dono; (ii) contagens "antes" (abaixo) anotadas; (iii) migration: `create table if not exists yt_own_video_daily_zeros_bkp as select …` das linhas sem atividade **e cobertas**, com RLS ligada, sem policy e `revoke all from anon, authenticated`; `delete` das mesmas linhas; (iv) contagens "depois"; (v) `vacuum full public.yt_own_video_daily` (comando à parte: não roda dentro de migration; trava a tabela por segundos) | sim: `insert into yt_own_video_daily select * from yt_own_video_daily_zeros_bkp on conflict do nothing` |
| **P4** (com o dono, 14 dias ou mais depois) | `drop table yt_own_video_daily_zeros_bkp` | só pelo CSV, ou pedindo de novo à Analytics API (ela devolveu a vida inteira dos vídeos em 35 chamadas; não é garantia documentada) |

**Conferência de contagem (invariantes; os números mudam todo dia, as igualdades não).** Antes de P3: `T` = linhas do diário; `A` = linhas com atividade; `Z = T − A`; `S` = soma de `views`; `C` = soma de `(covered_to − covered_from + 1)` do conjunto `base`. Exigido antes: `C = T`. Exigido depois: linhas = `A`; soma de `views` = `S`; linhas no backup = `Z`; `C` inalterado; para cada vídeo, dias cobertos sem linha = linhas dele no backup. Em 12/10: `T` = 96.892, `A` = 2.455, `Z` = 94.437.

**Plano de volta.** Até P4, o comando da tabela acima mais reverter o código de P2 (o leitor tolerante funciona nos dois estados, então a ordem não importa). O que não volta: o espaço, que o `vacuum full` devolveu.

**Ganho.** Tabela de 72 MB para menos de 1 MB (2.455 linhas); backup temporário de cerca de 23 MB até P4; depois, 71 MB livres. A regravação diária de 350 linhas (35 vídeos × 10 dias) some: é ela que inflou a tabela a três vezes o tamanho dos dados.

### 7.2 Curva de retenção do vídeo próprio (etapa E8)

**Decisão do dono (12/10):** "eu quero a curva de retenção sim… quero curva de retenção no site sim". É o equivalente, para os vídeos dele, aos "momentos mais vistos". É dado **autorizado** de Analytics: pode ser guardado por mais de 30 dias (fato 16), com a conferência de autorização que a coleta já faz a cada chamada (`authorization_verified_at`).

**Unidade (escrita na tela).** Cada ponto da curva é um par: **fração do vídeo** (`t`, de 0,01 a 1,00: cem posições, cada uma 1% da duração) × **fração da audiência** (`ratio`, o `audienceWatchRatio` do YouTube: quantas reproduções passavam por aquele trecho, divididas pelas views do vídeo). `ratio` **pode passar de 1** (trecho revisto, ou início de Short em repetição); nunca é cortado em 1. Minuto e segundo são derivados (`t` × duração), não gravados.

**Primeiro passo da etapa, antes de qualquer migration: uma conferência de leitura.** O inventário deixou não confirmado se a consulta respeita o período pedido. A conferência é uma só, sem gravar nada: para **um** vídeo com views recentes, pedir `reports.query` com `dimensions=elapsedVideoTimeRatio`, `metrics=audienceWatchRatio`, `filters=video==<id>;audienceType==ORGANIC` **duas vezes**: da publicação até hoje, e só os últimos 28 dias. Curvas diferentes = a API aceita período (caso A). Curvas idênticas ponto a ponto = só existe o acumulado (caso B). Erro na segunda = caso B, com o erro anotado. O resultado vai para o ledger, com as duas respostas guardadas como fixture de teste. Feita com o acesso do canal que o site já tem; é leitura.

| | **Caso A: a API aceita período** | **Caso B: só o acumulado** |
|---|---|---|
| O que se coleta | `vida` (publicação até hoje), relida quando o vídeo teve views novas e no máximo uma vez por semana; mais `primeiros_7_dias` e `primeiros_30_dias`, **uma vez** cada, quando a janela fecha | só `vida`, com a mesma regra de releitura |
| O que dá para retroagir | **tudo**: as três janelas dos 35 vídeos, numa leva (cerca de 105 consultas, espalhadas em 7 dias) | **só a curva acumulada de hoje.** Como a curva de 2019 de um vídeo de 2015 era diferente, e ninguém a guardou, a evolução **começa no dia do deploy**: cada semana sem coletar é uma leitura que não volta |
| Urgência | baixa: o passado é recuperável | **alta**: a E8 sobe para o começo da sequência (seção 14) |
| O que a tela diz | "primeiros 7 dias", "primeiros 30 dias" e "vida inteira", com seletor | "vida inteira, lida em dd/mm" e, havendo duas leituras ou mais, "como a curva mudou desde dd/mm" |

Nos dois casos a tabela é a mesma; no caso B a coluna `window_kind` só recebe `'vida'`.

**DDL proposto (migration MG5).**

```sql
create table if not exists public.yt_own_video_retention (
  youtube_video_id text not null,           -- id de 11 caracteres (NÃO o uuid), como nas outras yt_own_*
  window_kind text not null check (window_kind in ('vida', 'primeiros_7_dias', 'primeiros_30_dias')),
  segment text not null default 'organico' check (segment in ('organico')),   -- audienceType==ORGANIC; outros segmentos só com nova decisão
  window_end date not null,                 -- último dia (dia do YouTube) coberto pela leitura
  window_start date not null,               -- dia da publicação, ou o início da janela
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  points jsonb not null,                    -- lista ordenada por t: {t, ratio, relative, started, stopped, segment_impressions}
                                            --   t = fração do vídeo (0,01 a 1,00); ratio = fração da audiência (pode passar de 1)
                                            --   relative = relativeRetentionPerformance (0 a 1; 0,5 = mediana de vídeos de duração parecida)
                                            --   campo que a API não devolveu fica nulo, nunca 0
  point_count integer not null check (point_count > 0),   -- pontos que VIERAM (pode ser menos de 100)
  metrics_returned text[] not null,         -- as métricas que a API aceitou nesta leitura
  views_at_read bigint,                     -- views do vídeo na leitura: decide se vale reler
  source text not null default 'analytics_api' check (source in ('analytics_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null,             -- mesma lista de valores do diário (regra de contagem de views vigente)
  primary key (youtube_video_id, window_kind, segment, window_end)
);
create index if not exists idx_yt_own_video_retention_channel on public.yt_own_video_retention (channel_id, window_end);
alter table public.yt_own_video_retention enable row level security;
drop policy if exists "yt_own_video_retention_select" on public.yt_own_video_retention;
create policy "yt_own_video_retention_select" on public.yt_own_video_retention
  for select using (public.can_edit_site(site_id));    -- padrão das yt_own_*: dado privado do canal; escrita só por service role
```

- **Chave.** Uma linha por vídeo, janela, segmento e data de leitura: reler na semana seguinte cria linha nova (é o histórico da curva); reler no mesmo dia regrava a mesma. `youtube_channel_removal_impact` é recriada contando a tabela nova, e `youtube_channel_remove` conferida (`on delete restrict`, como o diário).
- **Coleta.** É o passo "retenção" já previsto no spec de coleta (seção 6, lote L3, e seção 7: último da ordem, teto de 40 s): `dimensions=elapsedVideoTimeRatio`, `filters=video==<id>;audienceType==ORGANIC`, métricas `audienceWatchRatio`, `relativeRetentionPerformance`, `startedWatching`, `stoppedWatching`, `totalSegmentImpressions`; se a API recusar métrica, repete só com as duas primeiras e `metrics_returned` diz o que veio. Um vídeo vence 7 dias depois da última linha ou tentativa; **e só é relido se `views` do diário cresceu desde `views_at_read`** (regra nova: num canal com 36 views em 90 dias, quase nenhum vídeo vence). Primeira leva espalhada por `sha256(uuid) mod 7`. Cota: uma consulta da Analytics API por vídeo e leitura; não toca a cota da Data API.
- **Zero × não medido.** Sem linha = "não coletada". Resposta sem ponto = tentativa `sem_dado_na_janela` em `yt_own_collection_attempts`, e a tela diz "o YouTube não devolveu curva para este vídeo (poucas views)". Ponto com campo ausente = nulo. Nunca curva inventada, nunca reta em zero.
- **Volume.** Cerca de 1,5 kB por linha (comprimida). Com a regra de views novas: da ordem de 1,5 MB por canal por ano; pior caso (todos os vídeos toda semana) 3 a 7 MB. Entra no ciclo de vida (9.2): a leitura mais recente de cada vídeo e janela nunca sai do online; as anteriores seguem a idade de corte.
- **Leitor e tela.** Leitor novo em `lib/proprio/` que devolve, por vídeo, a curva mais recente e a lista das datas de leitura; modelo com: o ponto em que a curva cruza 0,5 ("metade das pessoas já saiu aos m:ss"; se nunca cruza, "mais da metade fica até o fim"); as maiores quedas entre pontos vizinhos; os trechos em que `ratio` sobe (revistos); e `relative` como faixa ("acima / na média / abaixo de vídeos de duração parecida", cálculo do YouTube, dito assim). A seção fica na **página do vídeo próprio**; o canal não ganha tela própria da curva. O mockup de exemplo já existe; o definitivo é refeito com o dado real (6.5, mockup 11).
- **Quem não lê.** Nenhum pacote da forja (o escopo da fase 2a dela exclui retenção) e nenhum endpoint do Cowork nesta fase.
- **Relação com a A4.** A lacuna P2-3 da `REVISAO.md` ("a curva espera o lote L3, que tem migration") é esta etapa. A seção "Retenção: não coletada" das Tarefas 12 e 13 da A4 continua valendo até a E8 entregar.

### 7.3 Canal próprio em tabelas: origem de tráfego, termos de pesquisa, dispositivo, país, inscrito (etapa E11)

**Decisão do dono (12/10).** O canal próprio entra de uma vez, já em tabelas, com coleta diária e retroação: "vamos preparar para já colocar tudo de uma vez". É a etapa E3 do inventário. Vem **depois** da E12 (7.4), que liga os relatórios em lote e guarda o bruto, e por isso pode normalizar também o bruto que já estiver guardado. Continuam **fora**: o diário ampliado e a demografia em tabela (12.1).

**Cinco famílias, três tabelas, uma fonte por tabela** (duas fontes na mesma tabela obrigariam a conciliar dias e limiares diferentes; o spec de coleta já registra que as duas fontes não documentam o mesmo "dia").

| Família | Tabela | De onde vem | Até onde retroage | Unidade |
|---|---|---|---|---|
| **Origem de tráfego** (pesquisa, sugeridos, navegação, externo, Shorts, playlist…) por vídeo e dia | `yt_own_video_dim_daily`, `dim_kind = 'traffic_source'` | **Analytics API**, `dimensions=day,insightTrafficSourceType`, uma consulta por vídeo | até a publicação de cada vídeo (a API devolve para trás; empírico no diário: desde 2015) | views; minutos assistidos |
| **Dispositivo e sistema** | idem, `'device_os'` (valor `MOBILE\|ANDROID`) | Analytics API, `day,deviceType,operatingSystem` | idem | idem |
| **País** | idem, `'country'` (ISO de duas letras; `ZZ` = não identificado) | Analytics API. **NC se `day,country` é aceito numa consulta só** (conferência 1, abaixo). Se não for: daqui para a frente, uma consulta por vídeo com `startDate = endDate`; para trás, por mês de calendário | por dia, ou por mês se a conferência disser que não (a linha de mês leva `period_days` e a tela diz "no mês") | idem |
| **Inscrito × não inscrito** | idem, `'subscribed_status'` | Analytics API, `day,subscribedStatus` (vem sem custo: mais uma consulta por vídeo) | desde 15/12/2015 (limite da API) | idem |
| **Termos de pesquisa e sites externos** (o detalhe da origem), por vídeo e dia | `yt_own_video_traffic_detail_daily` | **relatório em lote** `channel_traffic_source_a3` (job **já ligado** desde 08/10). A Analytics API só dá os 25 maiores de um período, sem dia. **NC se o CSV traz o termo em `traffic_source_detail`** (conferência 2) | **só desde 08/09/2026**, e só se os relatórios forem baixados a tempo (abaixo). Antes disso: os 25 maiores por ano, pela Analytics API, em tabela de período (NC até onde: conferência 3) | views; minutos |
| **Impressões e taxa de clique por origem e por dispositivo** | `yt_own_video_reach_dim_daily` | **relatório em lote** `channel_reach_combined_a1` (já ligado; 21 baixados). Só existe em lote | só desde 08/09/2026 | impressões; taxa de clique de 0 a 1 |

**Nenhuma destas famílias espera um job novo:** as duas que dependem de lote usam tipos que já estão ativos. O que falta é o **normalizador** (hoje só `channel_reach_basic_a1` tem; fato 17). Com a E12, os relatórios de dispositivo, país e inscrito também passam a existir em bruto, por vídeo e dia e sem o limiar da Analytics API: ficam como conferência e como fonte de troca futura, mas **a tabela continua com uma fonte só** (a Analytics API, que é a que retroage).

**Conferências de leitura, antes da migration** (sem gravar nada; resultado no ledger): (1) `reports.query` com `dimensions=day,country` e filtro de um vídeo: aceita ou dá 400; (2) abrir um CSV real de `channel_traffic_source_a3` já baixado e ver se `traffic_source_detail` traz termos de pesquisa e URLs; (3) pedir o detalhe (`insightTrafficSourceDetail`, `YT_SEARCH`) de um vídeo antigo para 2019 e ver se volta dado; (4) a cota diária da Analytics API no console do Google (o inventário não a confirmou).

**DDL proposto (migration MG7).**

```sql
-- 1. Uma linha por vídeo × dia × valor da dimensão. ESPARSA: só existe linha onde houve atividade.
create table if not exists public.yt_own_video_dim_daily (
  youtube_video_id text not null,
  day_pt date not null,                          -- dia do YouTube, como no diário
  dim_kind text not null check (dim_kind in ('traffic_source', 'device_os', 'country', 'subscribed_status')),
  dim_value text not null,                       -- o código da API, sem tradução: 'YT_SEARCH', 'MOBILE|ANDROID', 'BR', 'SUBSCRIBED'
  period_days smallint not null default 1 check (period_days >= 1),   -- 1 = dia; mais de 1 só na retroação de país por mês (day_pt = 1º dia)
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint,
  engaged_views bigint,
  watch_time_minutes numeric,
  source text not null default 'analytics_api' check (source in ('analytics_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, dim_kind, dim_value)
);
create index if not exists idx_yt_own_video_dim_daily_channel on public.yt_own_video_dim_daily (channel_id, dim_kind, day_pt);

-- 2. O detalhe da origem: termo pesquisado, site externo, vídeo ou canal que sugeriu.
create table if not exists public.yt_own_video_traffic_detail_daily (
  youtube_video_id text not null,
  day_pt date not null,
  source_type text not null,                     -- 'YT_SEARCH', 'EXT_URL', 'RELATED_VIDEO', 'YT_CHANNEL', 'PLAYLIST'…
  detail text not null,                          -- termo como veio; URL SEM query string e sem fragmento; id de vídeo ou canal. Máximo de 300 caracteres
  period_days smallint not null default 1 check (period_days >= 1),   -- mais de 1 = "os 25 maiores do ano" da retroação
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint,
  watch_time_minutes numeric,
  source text not null check (source in ('reporting_api', 'analytics_api')),   -- lote = por dia; Analytics = só a retroação por ano
  source_report_id text,
  report_create_time timestamptz,
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, source_type, detail)
);
create index if not exists idx_yt_own_traffic_detail_channel on public.yt_own_video_traffic_detail_daily (channel_id, source_type, day_pt);

-- 3. Impressões por origem e por dispositivo (só existe em lote).
create table if not exists public.yt_own_video_reach_dim_daily (
  youtube_video_id text not null,
  day_pt date not null,
  traffic_source_type text not null,
  device_type text not null,
  operating_system text not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  thumbnail_impressions bigint,
  thumbnail_ctr numeric,                         -- 0 a 1, como veio (igual a yt_own_video_reach_daily)
  source_report_id text not null,
  report_create_time timestamptz not null,
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system)
);
-- RLS nas três, no padrão das yt_own_*: enable row level security; drop policy if exists; select por can_edit_site(site_id); escrita só service role.
-- A cobertura reaproveita yt_own_video_coverage (7.1): o check de metric_set ganha
--   'trafego', 'dispositivo', 'pais', 'inscrito', 'detalhe', 'alcance_dim'.
```

- **Gravação esparsa, no padrão da dieta.** Só existe linha onde houve atividade (alguma métrica diferente de zero). `yt_own_video_coverage` diz, por vídeo e conjunto, quais dias foram coletados. Leitura: dia coberto sem linha para um valor = **zero medido** naquele valor; dia fora da cobertura = **não medido**. Vídeo sem view no diário na janela não gera consulta de dimensão: a cobertura dele avança sozinha (zero views não têm origem), e isso é o que mantém a coleta barata num canal parado.
- **Escrita atômica.** `yt_own_dim_apply` (linhas, dias devolvidos, conjunto), no molde de `yt_own_daily_apply`: grava, apaga a linha de um dia revisado para zero, estende a cobertura. Para as duas tabelas de lote, o molde é `yt_own_reach_apply`: **relatório de `create_time` maior substitui; mais velho nunca passa por cima**.
- **Normalizadores de lote** (`channel_traffic_source_a3`, `channel_reach_combined_a1`): validam o cabeçalho contra um CSV **real** exportado, como `reach-csv.ts` (fixture sintética não vale, runbook de coleta seção 7). Cabeçalho diferente do esperado = erro e nenhuma linha.
- **Limiar do YouTube, dito na tela.** A API omite valores pequenos ("search terms and URLs that lead very small numbers of views will not appear"; o mesmo para origens). A soma das linhas de um dia pode ficar **abaixo** das views do diário: a tela mostra a diferença como "omitido pelo YouTube", nunca a redistribui.
- **Coleta diária.** Passo novo "dimensões", depois do diário e antes da retenção, com teto próprio dentro do relógio do cron (o plano refaz a soma dos tetos, hoje 200 s de 270 s); janela de 10 dias como o diário (o YouTube revisa os últimos dias); até quatro consultas por vídeo **com view na janela**; o que não couber grava `nao_alcancado_orcamento` e entra primeiro na execução seguinte. Os lotes entram pelo passo de relatórios que já existe.
- **Retroação.** Uma leva, espalhada por dias (`sha256 mod 7`), vídeo a vídeo, da publicação até hoje: para os 35 vídeos, cerca de 140 consultas de dimensão (mais as de país por mês, se a conferência 1 der "não": cerca de 2.500, espalhadas em duas semanas). Roda fora do cron diário, por um comando com retomada.
- **Termos de pesquisa e sites externos: acesso restrito.** Só quem **edita** o site lê, pelo mesmo token de edição da A4 (`EdicaoDoSite`, `lib/proprio/edicao.ts`): o leitor exige o token, não um booleano. **Não entram em nenhum pacote da forja nem em nenhum endpoint do Cowork.** A URL externa é gravada **sem a query string e sem o fragmento** (é ali que costumam vir e-mail, token e identificador de campanha), cortada na escrita, com teste. Um termo de pesquisa pode ser o nome de uma pessoa: por isso fica do lado privado e nunca é agregado numa tela que um usuário só de leitura veja.
- **Volume.** Retroação: o canal de hoje tem 2.455 dias de vídeo com atividade em 11 anos; a cerca de 12 linhas por dia ativo e 250 B por linha, **cerca de 7 MB uma vez**. Daqui para a frente, no ritmo de hoje (cerca de 220 dias de vídeo ativos por ano): **cerca de 1 MB por ano**. Se o canal crescer até o modelo do inventário (40 vídeos, 30% dos dias com view): 13 MB de dimensões, 3 MB de detalhe e 3 MB de alcance por dimensão, **cerca de 19 MB por canal por ano**. A tabela cresce com as views, não com o calendário. Entra na conta de 9.3.
- **Telas** (todas com mockup antes; 6.2 e 6.5): na página do vídeo próprio e na do canal próprio, "De onde vêm as views", "O que pesquisaram e de que sites vieram", "Em que aparelho", "De que país", "Inscritos e não inscritos"; o cartão "Só o seu canal mede" ganha as linhas correspondentes.
- **Outros pontos tocados:** `youtube_channel_removal_impact` recriada com as três tabelas; semente e2e; `database.types.ts`.

### 7.4 Ligar os relatórios em lote e guardar o bruto (etapa E12: a primeira do canal próprio)

**Decisão do dono (12/10, a que vale):** "vamos fazer como você recomendou e salvar os brutos de uma vez". É a primeira etapa do canal próprio porque é a única em que esperar custa dado: um relatório em lote só existe para os dias em que o job existia (ao ser ligado, cada tipo traz os 30 dias anteriores e mais nada).

**O que "ligar" exige, conferido no código (VERIFICADO; nenhuma migration).**

| O quê | Onde | Hoje | Passa a |
|---|---|---|---|
| A lista de tipos pedidos | `REPORT_TYPES_ENABLED`, `lib/youtube/reporting/types.ts:4-9` ("habilitar um tipo é um commit de uma linha") | 4 tipos | mais 10: `channel_combined_a3`, `channel_device_os_a3`, `channel_playback_location_a3`, `channel_province_a3`, `channel_demographics_a1`, `channel_subtitles_a3`, `channel_cards_a1`, `channel_end_screens_a1`, `channel_sharing_service_a1`, na versão que `reportTypes.list` devolver sem `deprecateTime` (NC qual é a corrente: a documentação cita `_a2` para dois deles). Anotações (descontinuadas) e os tipos de playlist ficam fora |
| O job de cada tipo | passo de jobs (`coleta/jobs-step.ts`): cria no ciclo seguinte e tira a linha de `desativado` | `desativado` | `ativo`, sem ação manual |
| O teto de download por execução | `MAX_DOWNLOADS`, `coleta/reports-step.ts:15` | 40 | o bastante para esvaziar a fila em menos de 20 dias: 10 tipos × 30 dias × 2 canais são cerca de 600 relatórios de histórico, **que vencem em 30 dias**, mais os 104 já na fila. O plano mede o tempo por download e fixa o número dentro do relógio do cron |
| O teto de tamanho por relatório | `MAX_GZ_BYTES`, `coleta/reports-step.ts:16`; acima dele o relatório vira `erro: grande_demais` e **não é guardado** | 2 MB comprimido | um teto que nenhum relatório real alcance (proposta: 10 MB), com o maior tamanho visto anotado |
| A ordem de prioridade | a ordem da lista é a prioridade de download | alcance primeiro | alcance, tráfego, e depois os novos |

- **Onde o bruto fica:** em `yt_reporting_report_blobs.csv_gz` (o CSV comprimido, dentro do banco), como hoje. **Validade:** na origem, 60 dias depois de gerado (30 para os de histórico); no banco, o tipo sem normalizador é apagado 180 dias depois do download (`yt_reporting_blobs_purge`), ou seja, **a partir de abril de 2027**. A E10 troca essa regra para "só apaga o que já foi exportado e confirmado" (9.2); com a fase de manutenção marcada pelo dono para a semana que vem, o bruto tem para onde ir muito antes disso.
- **Volume:** os 160 relatórios guardados hoje somam 21 kB. Com 14 tipos e o canal de hoje, da ordem de centenas de kB por ano; num canal ativo, cerca de 3 MB por canal por ano.
- **O que isso passa a guardar e que não existe por outro caminho:** demografia **por dia**; cartões e telas finais **por elemento**; idioma de legenda usado; e o **cruzamento** das dimensões na mesma view (origem × dispositivo × país × local de reprodução). Nada disso ganha tabela nem tela nesta fase: fica guardado para quando houver pergunta.
- **O que já está ligado e tem data para vencer** (os jobs existem; falta baixar):
  1. **Termos de pesquisa e sites por vídeo e dia.** Em 12/10 há **38 relatórios de `channel_traffic_source_a3` listados e não baixados** (e 66 de `channel_basic_a3`). Os de histórico, que cobrem de 08/09 a cerca de 08/10/2026, **vencem na origem a partir de cerca de 07/11/2026**. O que não for baixado até lá não volta: a Analytics API só devolve os 25 maiores por período. Subir o teto de download resolve os dois de uma vez.
  2. **Impressões por origem e por dispositivo.** Só existem em lote, desde 08/09/2026; os 21 relatórios estão baixados.
- **Sem tela e sem leitor:** a E12 só guarda. Nada do bruto é lido por tela, pela forja ou pelo Cowork; a leitura é só de quem edita o site (RLS de hoje).

## 8. Leitura pela forja e pelo Cowork (etapa E7)

**Quem lê hoje.** A forja lê só `GET /api/pipeline/youtube/competitors/readings` (o pacote de `forja/sent.ts`: título, views, múltiplo e até 400 registros diários por pedido). O Cowork lê `competitors/channels`, `changes`, `outliers`, `insights` e os recursos MCP sobre `competitor_channels` e `competitor_changes`.

**Decisão: nenhuma mudança no kit da forja e nenhum campo novo nos pacotes da forja nesta fase.** Motivos: o orçamento acoplado (20 min do claim < 25 min do cron < 30 min do vigia) foi dimensionado para o pacote de hoje; o validador confere cada número citado contra o pacote; e por meses quase toda medida nova é "não medido". Qualquer mudança no kit é do dono, em fase própria.

**O que entra para o Cowork (aditivo, sem rota nova, `endpoint_count` igual):** em `competitors/channels`, por canal: direção M3(a) e (b), estado M8, ritmo M6, taxa de acerto M4, handle, país, data de criação. Em `competitors/changes`: um parâmetro opcional `campos=todos` devolve também as mudanças de campo; **sem o parâmetro a resposta é a de hoje** (com teste que chama sem o parâmetro e afirma isso). Atualizar `apps/web/data/pipeline-docs/cowork-docs-youtube.md` e `docs/cowork-pipeline-reference.md`, e rodar a semente da referência.

**O que não entra em pacote nenhum:** `raw jsonb`; a descrição do canal (costuma trazer e-mail de contato do criador); a lista de vídeos de playlists; as leituras das primeiras horas em bruto (entra só M1); **a leitura M10** (um indício sem o texto obrigatório ao lado vira afirmação num texto gerado; reabrir quando houver dado para conferir os limiares); a curva de retenção do canal próprio; **os termos de pesquisa e os sites externos do canal próprio** (7.3: só quem edita o site, pelo token de edição; teste que varre as respostas do pipeline); o conteúdo de vídeo que o dono mandou apagar (some de todo endpoint no mesmo instante, por ter saído do banco); **o texto dos comentários de terceiros e das respostas do criador (4.6, emenda v2.1): não entra em nenhum pacote da forja nem do Cowork sem o dono decidir** (teste que varre as respostas do pipeline com um comentário sentinela na semente, item 119). A identidade do autor (nome, id, foto) também nunca entra. M11 pode entrar em `competitors/channels` como as outras medidas, porque é uma contagem sem texto.

**Quando o dado novo ainda não existe (a regra contra "falha em verde").** Toda medida sai como objeto com `estado`; uma medida não medida sai **com** `estado: 'nao_medido'`, `motivo` e, quando há, `desde`: nunca é omitida, nunca é `null`, `0` ou lista vazia. O endpoint acrescenta `medidas_indisponiveis` (contagem por motivo). Teste obrigatório por medida: banco sem nenhuma linha das tabelas novas devolve `nao_medido` com motivo, e o texto que o Cowork recebe contém a frase do motivo. Se um dia um pacote da forja ganhar uma medida, a linha "não medido: <motivo>" vai escrita no pacote; um pacote sem a linha é erro, não "ok".

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
- **E15, por execução e não por canal:** `videos.list` custa 1 unidade por chamada, com até 50 vídeos. Os vídeos de até 14 dias de todos os canais vão juntos: com 3,8 por canal, são 57 vídeos com 15 canais (2 chamadas por hora), 76 com 20 (2), 285 com 75 (6) e 760 com 200 (16). Vezes 24 horas: **48, 48, 144 e 384 unidades por dia**.

| Canais | Cota por dia na v2 | Com a E14 | **Com a E14 e a E15 (padrão proposto)** | Com todas as opções ligadas |
|---|---|---|---|---|
| 15 (hoje) | ≈ 240 | ≈ 260 | **≈ 310** | ≈ 820 |
| 20 | ≈ 320 | ≈ 347 | **≈ 395** | ≈ 1.065 |
| 75 | ≈ 1.200 | ≈ 1.300 | **≈ 1.445** | ≈ 3.920 |
| 200 | ≈ 3.200 | ≈ 3.470 | **≈ 3.855** | **≈ 10.440: passa do teto de 10.000** |

O que cada opção soma. Da E14, por canal e dia: respostas completas das conversas escolhidas (pergunta 11), até +2,4; inscritos do autor, opção B (pergunta 9), +1,6; reconferência mensal dos comentários guardados por 12 meses (pergunta 13), ≈ +3,0. Da E15: leitura de 30 em 30 minutos (pergunta 17) dobra a parcela dela (96, 96, 288 e 768 por dia; de 2 em 2 horas, a metade); **descobrir vídeo novo de hora em hora (pergunta 19) é a opção cara: 24 unidades por canal por dia** (360, 480, 1.800 e 4.800). A retroação de comentários (pergunta 12) custa 1.389 unidades uma vez. Se a conferência por id exigir uma chamada por comentário (pior caso da linha 14 de 4.6.1), a parcela de 0,54 vira até 6,4 por canal e dia.

**No padrão proposto a cota continua não sendo o limite em nenhum cenário** (61% de folga com 200 canais). Com todas as opções ligadas ela **passa do teto com 200 canais**; até 75 canais, sobra. O que pesa no dia a dia é o número de chamadas HTTP no relógio de cada cron, e por isso os dois passos têm teto próprio (4.6.4 e 4.7.5).

## 10. Itens de aceite, por etapa

São 143 itens: 1 a 53 vêm da v1 (dois foram ajustados, o 7 e o 34); 54 a 106 são da v2 (103 a 106 estão junto da E13); 107 a 143 são da emenda v2.1, no fim da seção (E14: 107 a 127; E15: 128 a 143). Cada item é uma consulta ou uma tela. `:hoje` é a data de São Paulo. Os itens **NP** são os de "nada se perde": rodados no dia seguinte ao deploy e em mais dois dias.

**E1: campos, sinalizadores, `raw`**
1. Depois de uma rodada completa (4 faixas), todo vídeo lido tem `raw` corrente: `select count(*) from competitor_videos v where last_checked_at > now() - interval '1 day' and not exists (select 1 from competitor_raw r where r.video_id = v.id and r.is_current)` = 0.
2. Todo canal tem `raw` corrente e as colunas `custom_url` e `published_at` preenchidas (ou nulas só onde a resposta não trouxe, conferido no `raw`).
3. Uma segunda rodada sem mudança no YouTube não cria linha: contagem de `competitor_raw` e de `competitor_field_versions` igual antes e depois (teste com resposta fixa; a ordem das chaves do JSON trocada não muda o hash).
4. Mudar só `statistics` na resposta fixa não cria versão; mudar uma tag cria uma versão de `tags` com `window_start` = leitura anterior e fecha a antiga.
5. Valor que vai e volta (A, B, A) gera três versões, sem erro de chave.
6. Vídeo cuja resposta não traz `commentCount`: `comment_count` nulo e `comments_disabled = true`; nenhuma linha nova com `comment_count = 0` vinda de ausência (teste que apaga o campo da resposta).
7. Vídeo ausente de `videos.list` em duas leituras seguidas ganha `missing_since`; ausente em uma só, não; ao voltar, `missing_since` nulo e versão `availability = 'no_ar'`. Marcar **não apaga nada** (a contagem de linhas do vídeo é igual antes e depois).
8. Vídeo com `liveStreamingDetails` tem `was_live = true` e os horários; sem, `was_live = false` (não nulo) depois da primeira leitura.
9. As contagens das telas não mudam: "Trocas N" da lista, do painel e da comparação iguais antes e depois do deploy para os 15 canais; `competitors/changes` devolve o mesmo corpo sem parâmetro.
10. `youtube_quota_usage` tem a linha do dia com `units_used > 0` e o total por modo em `operations`.
11. Usuário sem `can_edit_site` não lê `competitor_raw`; usuário sem `can_view_site` não lê `competitor_field_versions` (teste de RLS com o GUC `app.site_id` forjado por papel sem superusuário, regra do projeto).
12. **NP-E1:** `select count(distinct competitor_channel_id) from competitor_raw where last_seen_at::date = :hoje` = número de canais sincronizados no dia; e `select count(*) from competitor_videos where last_checked_at::date = :hoje and discovered_at is null and published_at > '<deploy>'` = 0.

**E2: série**
13. Todo vídeo em faixa diária tem linha do dia: `select count(*) from competitor_videos v where series_tier = 'diaria' and missing_since is null and not exists (select 1 from competitor_video_daily d where d.video_id = v.id and d.snap_date = :hoje)` = 0, depois das 18:00 de São Paulo.
14. Vídeo com idade ≤ 30 dias fora dos 50 mais recentes está em faixa diária (teste com canal de 80 vídeos em 30 dias).
15. Nenhum vídeo guardado fica mais de 8 dias sem ponto: `select count(*) from competitor_videos v where missing_since is null and published_at is not null and not exists (select 1 from competitor_video_daily d where d.video_id = v.id and d.snap_date > :hoje - 8)` = 0, a partir do oitavo dia.
16. Vídeo descoberto com menos de 24 h tem pelo menos 8 leituras em `competitor_video_early` ao completar 72 h (tolerância: 1 faixa perdida); vídeo descoberto depois de 24 h não tem nenhuma.
17. Promoção: vídeo semanal com ganho de 1.000 views e 5% numa semana tem `daily_until = :hoje + 28` e linha diária no dia seguinte; troca de título num vídeo semanal faz o mesmo; no dia 29 volta a semanal sem perder linha.
18. Canal com mais de 200 vídeos na regra diária: 200 em faixa diária, o resto semanal, e a execução registra o número cortado (não é silencioso).
19. O motor trata intervalo semanal como média da semana e buraco como buraco; efeito de troca sobre série semanal responde "inconclusivo: série semanal" (testes em `series` e `effect`).
20. Os números atuais das telas (views por dia, múltiplo, mediana) dos 15 canais não mudam com o deploy (comparação de antes e depois sobre a mesma base).
21. O pacote do maior canal com um ano de série simulada cabe em `PACK_BUDGET`, ou a série semanal fica fora do pacote; `PACK_VERSION` subiu e `pack-shape.test.ts` passa.
22. Uma execução do cron com 75 canais simulados termina dentro dos 200 s do lote, ou deixa `remainingDue` para a seguinte sem perder o dia.
23. **NP-E2:** `select series_tier, count(*) from competitor_videos where missing_since is null group by 1` comparado com `select count(*) from competitor_video_daily where snap_date = :hoje`: diários do dia ≥ vídeos em faixa diária; e semanais lidos nos últimos 7 dias = vídeos em faixa semanal.

**E3: playlists**
24. Toda playlist pública de um canal aparece em `competitor_playlists` em até 7 dias; item removido ganha `removed_since`; playlist apagada, `missing_since`.
25. Canal com mais de 50 playlists: a execução registra o corte e a semana seguinte cobre as restantes.
26. **NP-E3:** `select count(distinct competitor_channel_id) from competitor_playlists where last_seen_at > now() - interval '8 days'` = canais com pelo menos uma playlist.

**E4: medidas**
27. Cada medida M1 a M9 tem função pura com testes de borda: exatamente no limiar (±10%, 3 vídeos, 2×, 1.000 views), amostra abaixo do mínimo, divisor zero (nunca `Infinity` nem `NaN`).
28. Banco sem nenhuma linha nova: toda medida devolve `nao_medido` com motivo (teste que **apaga** os dados, não que os substitui).
29. M1 de um vídeo com série completa confere, à mão, com as duas leituras vizinhas (três vídeos reais de produção, conta anotada no plano).
30. M3(a) dos 15 canais confere com `competitor_channel_snapshots` por consulta direta; janela que cruza 24/08/2026 sai marcada.
31. Vídeo com `was_live` não entra nas medianas de M1, M2 e M7, e o resultado diz quantos saíram.
32. Longos e Shorts nunca na mesma mediana (teste com canal misto).

**E5: telas**
33. T0: o defeito do contêiner reproduzido em navegador com medidas anotadas; teste e2e vermelho antes e verde depois; a 1440 e 390 px, nos dois temas, a página rola até o fim e não há faixa preta.
34. Cada tela só começa a ser codificada com o mockup correspondente aprovado (etapa E13, 6.5; itens 98 a 106).
35. Em cada tela, cada número novo tem base, janela e ⓘ com a conta e a frase "cálculo do Observatório sobre dados públicos do YouTube".
36. Cada tela foi vista em navegador nos estados: vazio (banco de antes da E1), parcial (uma semana de dado) e cheio (semente de um ano), a 1440 e 390 px, tema escuro e claro, sem rolagem horizontal e sem erro de console.
37. "Não medido" usa a cor e a forma únicas, e o motivo vem da lista fechada de 6.1.5; nenhum zero aparece onde a contagem é oculta ou ausente.
38. Seletor: digitar, setas, Enter, Esc e o canal indisponível funcionam por teclado; busca sem acento; itens de 44 px a 390 px.
39. A conta "Trocas" é igual na lista, no painel e na comparação; a descrição aparece à parte nos dois lugares.
40. `?base=` ausente dá a base de 90 dias (teste que apaga o parâmetro).
41. Usuário só de leitura não vê nada de `competitor_raw` no HTML nem no RSC.

**E6: dieta**
42. Depois de P1: `C = T` (seção 7) e, para cada vídeo, um intervalo por conjunto.
43. Depois de P2, por 3 execuções: nenhuma linha nova sem atividade; `max(covered_to)` avança a cada dia em todos os vídeos; as telas da A4 mostram os mesmos números de antes (views por dia do canal: "35" na semente; conferência nas três telas).
44. Leitor: dia coberto sem linha vira `views: 0`; dia fora da cobertura não vira linha; canal parado com cobertura em dia **não** diz "coleta parada" (teste com o perfil "parado" da semente).
45. Coleta: num vídeo sem view há dois anos, a janela pedida à API começa em `hoje − 10`, não há dois anos (teste).
46. Dia revisado para zero pelo YouTube tem a linha apagada e continua coberto (teste da função).
47. Depois de P3: as cinco igualdades da conferência de contagem, anotadas com os números do dia, antes e depois.
48. `pg_total_relation_size('yt_own_video_daily')` menor que 2 MB depois do `vacuum full`.
49. Ensaio do plano de volta no banco local: restaurar do backup devolve `T` linhas e as telas não mudam.
50. **NP-E6:** `select count(*) from youtube_videos v where not exists (select 1 from yt_own_video_coverage c where c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base' and c.covered_to >= current_date - 4)` = 0 (4 dias = atraso de 2 a 3 dias da fonte mais um).

**E7: Cowork**
51. `competitors/channels` devolve as medidas com `estado`; `competitors/changes` sem parâmetro é idêntico ao de hoje; com `campos=todos` traz as mudanças de campo.
52. Os dois documentos do pipeline atualizados e a semente rodada; os testes de estrutura do registro passam com `endpoint_count` inalterado.
53. Nenhum pacote da forja mudou: o retrato de `buildSent` de antes e de depois é igual (teste).

**Itens novos da v2** (numerados na sequência, de 54 a 106, para não trocar o número dos anteriores; cada um diz a etapa).

**E4: marcas e M10**
54. Marca gravada = cálculo: para todo vídeo com série completa, `competitor_video_marks.views` é igual a M1 calculada sobre a série (teste); com leituras vizinhas além do limite, **nenhuma** linha é gravada e a medida responde o motivo.
55. M10: testes de borda das três condições (exatamente 2×, exatamente metade, exatamente 2%); com duas condições de três o resultado é `nao_e_o_caso`; com curtidas ocultas **e** comentários desligados é não medido; canal com 4 vídeos elegíveis é não medido; ao vivo e estreia ficam fora.

**E5: telas (acréscimos)**
56. Toda tela que mostra a leitura M10 traz o texto obrigatório da seção 5 **no corpo**; e nenhuma tela de concorrente contém a palavra "retenção" (teste sobre o HTML das telas de canal, vídeo, Outliers e Comparar de um concorrente).
57. Vídeo com `missing_since` não some de nenhuma lista: aparece com a pastilha, sem link para o YouTube, com a série terminando na data (teste e2e com a semente).

**E8: curva de retenção do canal próprio**
58. A conferência de leitura de 7.2 foi feita **antes** da migration, e o ledger traz: o vídeo usado, as duas consultas, se as curvas diferem (caso A ou B) e as duas respostas guardadas como fixture.
59. Depois da primeira leva (7 dias): `select count(*) from youtube_videos v where not exists (select 1 from yt_own_video_retention r where r.youtube_video_id = v.youtube_video_id and r.window_kind = 'vida') and not exists (select 1 from yt_own_collection_attempts a where …retenção deste vídeo…)` = 0: todo vídeo tem curva **ou** tentativa com motivo.
60. Reler no mesmo dia não cria linha; na semana seguinte, com views novas, cria; **sem views novas, a API não é chamada** (teste que conta as chamadas).
61. Resposta sem ponto grava a tentativa `sem_dado_na_janela` e nenhuma linha; ponto com campo ausente fica nulo; `ratio` maior que 1 é preservado; resposta com 37 pontos grava `point_count = 37`.
62. A API recusando uma métrica: a coleta repete com as duas básicas e `metrics_returned` diz o que veio (teste com resposta de erro).
63. Usuário sem `can_edit_site` não lê `yt_own_video_retention` (teste de RLS com o GUC forjado por papel sem superusuário).
64. A seção "Retenção" da página do vídeo próprio foi vista em navegador com dado real nos três estados (coletada, não coletada, "o YouTube não devolveu curva"), a 1440 e 390 px, nos dois temas; a frase "metade das pessoas já saiu aos m:ss" confere à mão com os pontos em dois vídeos; a data da leitura está na tela.
65. **NP-E8:** todo vídeo próprio cujo diário ganhou views nos últimos 14 dias tem leitura ou tentativa de retenção nos últimos 8 dias (consulta = 0 faltando).

**E9: o que saiu do YouTube**
66. Vídeo com `missing_since` e sem decisão aparece na fila com todos os campos de 4.5 e a frase "o YouTube não diz o motivo"; um canal inteiro fora do ar é **um** item.
67. **Sem resposta, o dado fica:** teste que avança o relógio 400 dias, roda todas as rotinas (sincronização, crons, export de lote por idade) e afirma que nenhuma linha de conteúdo, versão ou miniatura do vídeo ausente foi apagada.
68. "Manter": grava decisão, quem e quando, e uma linha em `audit_log`; o vídeo segue nas telas com a pastilha e nas medidas do tempo em que esteve no ar.
69. "Apagar": zero linhas do vídeo em cada tabela listada em 4.5; nenhum arquivo no prefixo dele no Blob; uma linha em `competitor_removed_items` só com id, datas e contagens; `audit_log` sem título nem conteúdo; o pacote em cache do canal foi invalidado.
70. Falha ao apagar no Blob: `blobs_pending` preenchido, a tela diz "apagando: faltam N miniaturas", e a nova tentativa conclui (teste que faz o Blob falhar uma vez).
71. Usuário sem `canAdminSite` não consegue nenhuma das duas respostas; usuário só de leitura não vê a fila nem `competitor_removed_items`.
72. Vídeo apagado que volta ao ar **não** é recoletado e gera o item "voltou ao ar; você apagou em dd/mm".
73. Vídeo sem decisão que volta ao ar sai da fila sozinho, com a volta no histórico de campo.

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

**E11: canal próprio em tabelas**
83. As quatro conferências de leitura de 7.3 feitas **antes** da migration e anotadas no ledger (país por dia aceito ou não; o CSV real traz ou não os termos; até onde o detalhe por período retroage; a cota da Analytics API), com as respostas guardadas como fixture.
84. Os dois normalizadores (`channel_traffic_source_a3`, `channel_reach_combined_a1`) processaram todo relatório `baixado` do tipo: `select count(*) from yt_reporting_reports where status = 'baixado' and normalized_at is null and report_type_id in (…)` = 0, e o bruto anterior à etapa (desde 08/09/2026) também foi normalizado.
85. Gravação esparsa: nenhuma linha das três tabelas com todas as métricas zeradas ou nulas; dia coberto sem linha lê como zero naquele valor; dia fora da cobertura lê como "não medido" (teste do leitor que **apaga** a cobertura).
86. Normalizador: cabeçalho de CSV diferente do esperado dá erro e nenhuma linha (teste com o CSV real e com uma coluna trocada).
87. Relatório mais novo substitui o mais velho; o mais velho, chegando depois, não muda nada (teste das funções de gravação).
88. URL externa gravada sem query string e sem fragmento, com no máximo 300 caracteres (teste com `?utm_source=…&email=…#x`).
89. Termos e sites: o leitor só aceita o token de edição; usuário só de leitura não os vê no HTML nem no RSC; papel sem `can_edit_site` não lê as três tabelas (RLS com o GUC forjado); nenhuma resposta de endpoint do pipeline (Cowork e forja) contém linha de `yt_own_video_traffic_detail_daily` (teste que varre as respostas com um termo sentinela na semente).
90. Retroação concluída: a cobertura de cada conjunto começa na publicação de cada vídeo, ou no limite que a API devolveu, anotado por conjunto; para todo vídeo e dia, a soma das views por origem é menor ou igual às views do diário, e a diferença aparece na tela como "omitido pelo YouTube".
91. A coleta diária cabe no relógio do cron: o passo "dimensões" tem teto, grava `nao_alcancado_orcamento` quando não chega, e o que ficou para trás entra primeiro na execução seguinte; vídeo sem view na janela não gera chamada (teste que conta as chamadas).
92. **NP-E11:** todo vídeo próprio com views nos últimos 14 dias tem cobertura dos conjuntos `trafego`, `dispositivo`, `pais` e `inscrito` até `current_date - 4` (consulta = 0 faltando).
93. As seções novas das páginas do vídeo e do canal próprios foram vistas em navegador, com mockup aprovado antes, nos estados vazio, parcial e cheio, a 1440 e 390 px, nos dois temas; `youtube_channel_removal_impact` conta as três tabelas.

**E12: relatórios em lote e bruto**
94. Um ciclo depois do deploy, todo tipo da lista tem job `ativo` nos dois canais: `select report_type_id, status, count(*) from yt_reporting_jobs group by 1, 2` não mostra nenhum tipo da lista em `desativado` (ou mostra `tipo_indisponivel` com o motivo anotado, se a API não oferecer o tipo ao canal).
95. **Nada vence sem ser baixado:** `select count(*) from yt_reporting_reports where status = 'listado' and create_time < now() - interval '20 days'` = 0 e `select count(*) from yt_reporting_reports where status = 'expirado_sem_baixar' and create_time > '<deploy>'` = 0, conferidos antes de 01/11/2026 e em todo dia dos 30 seguintes.
96. Nenhum relatório em `erro` com `grande_demais`; o maior `bytes` visto está anotado e fica abaixo da metade do teto novo.
97. A execução do cron continua dentro do relógio com o teto de download novo (duração do passo de relatórios anotada em três execuções), e o tamanho de `yt_reporting_report_blobs` depois de 30 dias está anotado e comparado com a estimativa de 7.4.

**E13: mockups**
98. Cada mockup da lista de 6.5 foi feito com a skill `frontend-design`, na identidade aprovada (tokens de `chrome.css` e `tokens-telas.css`; `grep` por `color-mix` nos arquivos do mockup = 0), e a pasta traz `index.html`, `REVISAO.md` e `shots/`.
99. Cada mockup mostra: caso cheio e caso magro **com os números reais dos canais do dono**, estado sem dado, "não medido" com motivo da lista fechada, 1440 e 390 px, tema claro e escuro (uma captura de cada em `shots/`); e a `REVISAO.md` diz, tela a tela, o que é dado real e o que é exemplo.
100. O ledger da fase tem uma linha por mockup com data e veredito do dono (aprovado, ajuste pedido, reprovado); nenhum mockup foi apresentado antes da resposta ao anterior.
103. **Nenhum mockup foi ao dono com achado "bloqueia" ou "corrige" aberto:** para cada mockup, a `REVISAO-UX.md` traz o veredito "pronto para o dono" em todas as telas, com data anterior à da apresentação.
104. A `REVISAO-UX.md` de cada rodada fica ao lado do mockup e traz, por tela, as medidas (contraste de texto e de elemento gráfico nos dois temas, com o número; alvos de toque; 390 px sem rolagem horizontal) e a lista do que o revisor **não** conseguiu verificar.
105. Os nove mockups de `2026-10-12-a4-proprio-e-ajustes/` passaram pelo revisor antes de serem levados ao dono.
106. Cada tela implementada foi conferida pelo `revisor-ux-senior` contra o mockup aprovado, em navegador, antes de ir a produção, e a conferência está registrada (divergência não declarada foi corrigida ou aceita pelo dono por escrito).
101. **Nenhuma tela virou código sem mockup aprovado:** cada tarefa de tela do plano cita a linha do ledger com a aprovação, e a revisão final da fase confere a lista de telas entregues contra o ledger (o T0 é a única exceção, por ser conserto).
102. O mockup do "Ver antigo" é um esboço marcado como tal, e nenhuma tarefa de código desta fase depende dele.

**E14: comentários de destaque (emenda v2.1)**
107. **Antes da migration**, a chamada de leitura de 4.6.1 foi feita pelo dono ou com a autorização dele, e as respostas estão guardadas como fixture e anotadas no ledger: a chave de API basta ou não; quantas respostas vêm em `replies` e em que ordem; `textOriginal` vem ou não; `comments.list?id=` com um id real e um inventado (quantos ids por chamada; o ausente derruba a chamada ou some da lista); o corpo exato do erro `commentsDisabled`. **Se a chave não bastar, a etapa para.**
108. As perguntas 9 e 10 têm resposta do dono registrada no arquivo de decisões **antes** de qualquer comentário ser gravado em produção; a 14 tem resposta antes de a fila mostrar comentários.
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

**E15: ritmo por hora (emenda v2.1)**
128. **NP-E15:** todo vídeo da lista horária tem leitura em pelo menos 22 das últimas 24 horas: `select count(*) from competitor_videos v where missing_since is null and published_at > now() - interval '13 days' and published_at < now() - interval '1 day' and (select count(*) from competitor_video_hourly h where h.video_id = v.id and h.hour_slot > now() - interval '24 hours') < 22` = 0 (fora os vídeos cortados pelo teto, que a execução lista).
129. A lista: vídeo com 15 dias não é lido; canal com 40 vídeos em 14 dias tem 25 lidos e a execução registra 15 fora; ao vivo em andamento fica fora; os canais do dono estão na lista (teste da função que monta a lista).
130. As chamadas juntam vídeos de canais diferentes: com 57 vídeos de 15 canais a execução faz 2 chamadas, não 15 (teste que conta as chamadas).
131. Duas execuções na mesma hora gravam uma leitura só por vídeo (teste que chama duas vezes).
132. Intervalo limpo × longo: 50 e 70 minutos são limpos, 49 e 71 não; começo a 6 minutos da hora cheia não é limpo; um buraco de 2 horas **não é dividido**: nenhuma casa recebe a diferença, `long_intervals` sobe 1 e `long_likes` recebe o valor (teste com leituras fixas).
133. Contador que diminui: a diferença negativa não entra em nenhuma casa, **não vira zero** (a casa da hora seguinte não a absorve), sobe `neg_*_n` e soma em `neg_*_sum`; a curva de 72 horas guarda o contador como veio; o dia fica fora da fatia daquele contador.
134. A soma é idempotente: `competitor_hour_fold` chamada duas vezes para o mesmo dia deixa os vetores iguais; leitura crua de dia sem registro nunca é apagada (teste que desliga a soma por dois dias: as leituras continuam lá, e a execução devolve quantas esperam).
135. A fatia: para todo mapa medido, a soma de p(h) nas 24 horas é 1 (±0,001); dia com intervalo longo ou abaixo do movimento mínimo não entra; **um vídeo com cem vezes mais curtidas que os outros muda o perfil no peso de um dia de vídeo, não de cem** (teste com dados fixos).
136. Fases: leitura de vídeo com 2 dias vai para "lancamento"; com 5 dias, para "depois"; nenhuma leitura entra nas duas; nenhuma tela soma as duas.
137. Zero × não medido: casa com `n_intervals = 0` lê como "sem leitura nesta hora", casa com intervalos e soma 0 lê como zero medido; com o banco **sem nenhuma linha** das tabelas novas, M13 e M14 devolvem `nao_medido` com motivo e a data de início.
138. M13 e M14: testes de borda (exatamente 28 dias de vídeo e 3 vídeos; 27 e 2 são não medido; exatamente 20% de horas sem leitura); a comparação de duas janelas devolve a razão e as duas bases; M14 exclui vídeo descoberto com mais de 6 horas e diz quantos.
139. Armazenamento: `select count(*) from competitor_video_hourly where hour_slot < now() - interval '4 days'` = 0 em todo dia; trinta dias depois do deploy, o tamanho das três tabelas novas e de `competitor_video_early` está anotado e comparado com 9.5 (≈ 0,85 MB por canal por ano); diferença acima de 30% corrige 9.5. O item 16 da E2 passa a exigir pelo menos 60 leituras em 72 horas para vídeo descoberto com menos de 24 horas.
140. **A medição que decide o que se mostra, 14 dias depois do deploy,** anotada no ledger: para cada contador, a proporção de intervalos de 1 hora com diferença zero seguidos de salto, por faixa de tamanho de vídeo; de quanto em quanto tempo cada contador de fato anda; e se duas leituras com 5 minutos de distância devolvem o mesmo número (cache). Com ela o dono decide se o mapa de views por hora é mostrado, e se 30 minutos ou 2 horas servem melhor (pergunta 17).
141. Infra: `apps/web/vercel.json` tem exatamente uma linha nova (`sync-youtube?mode=hourly`, `0 * * * *`); `select count(*) from cron.job where command ilike '%mode=hourly%'` = 0 (nenhum job de `pg_cron`); a rota responde ao `GET` com o segredo do cron; a trava usada é a do banco (`cron_try_lock`), provada por teste que dispara duas execuções simultâneas; chamar a rota **sem** `mode` e com os modos antigos devolve o mesmo de antes (teste).
142. **Falha em vermelho:** `cron_health` tem a chave `sync-youtube-hourly`; duas horas sem sucesso é falha na rota de saúde; teste que **apaga** a linha e afirma "sem leitura", nunca verde; a tela do mapa mostra "lidas N de M horas" e, com o cron parado em teste, mostra a falta. `youtube_quota_usage.operations` traz o modo `horario`, e a duração da execução com 75 canais simulados está anotada.
143. RLS das três tabelas com o GUC forjado; `competitor_channel_removal_impact` conta as três; remover um canal zera as três para ele; o mapa foi visto em navegador, com mockup 21 aprovado antes, nos casos cheio, magro e "não medido", a 1440 e 390 px, nos dois temas.

## 11. Riscos

### 11.1 Riscos aceitos pelo dono

**A regra dos 30 dias das Developer Policies do YouTube.** Fonte: <https://developers.google.com/youtube/terms/developer-policies>, seção III.E.4, lida na página oficial em 12/10/2026 (por ferramenta que devolve trechos curtos; **o dono deve reler a seção inteira antes de aprovar**).

- **O que diz.** III.E.4.b: "To be clear, an API Client must not store statistics retrieved as Non-Authorized Data for more than 30 days." III.E.4.d: o cliente pode "temporarily store limited amounts of Non-Authorized Data" pelo tempo necessário, "but not longer than 30 calendar days"; depois disso "must either delete or refresh the stored data". III.E.4.e: "API Clients must use reasonable efforts to ensure that their stored API Data is consistent with the current data available through YouTube API Services." III.E.4.h: o cliente não deve "replace API Data with similar, independently calculated data" nem usar dados da API "to create new or derived data or metrics"; métrica que não é do YouTube, mostrada ao lado, precisa de aviso claro. III.E.2: só se agregam dados de canais "under the same content owner".
- **O que o projeto faz.** Lê com chave de API (dado não autorizado) e **guarda a série histórica**: canal por dia desde 01/06/2026, vídeo por dia desde 03/10/2026, versões de título, miniatura e descrição; a A5 amplia isso. Calcula medidas próprias (seção 5) e compara canais de donos diferentes.
- **O que o "refresh" resolve e o que não resolve.** Atualizar o dado dentro do prazo mantém em dia o **valor atual** (as colunas de `competitor_videos` e `competitor_channels`, relidas até 4 vezes por dia). **Não torna conforme guardar os valores antigos**: uma contagem de 40 dias atrás continua guardada há mais de 30 dias. O projeto guarda histórico por decisão do dono, sabendo disso.
- **Decisão do dono (12/10):** seguir. "É tudo para uso pessoal, não é produto." Este spec não propõe contorno técnico nem ocultação.
- **Consequência possível.** A seção III.H reserva ao YouTube o direito de "survey, monitor, and/or audit" o uso; III.D.3 diz que o YouTube "may use quotas and place use restrictions"; o pedido de aumento de cota exige auditoria de conformidade (inventário 2.3). Na leitura feita, a página de políticas não traz uma frase geral listando a punição por descumprimento (a suspensão aparece escrita para casos específicos); a suspensão ou o encerramento do acesso do **projeto** de API é a consequência prevista nos Termos de Serviço da API, que este spec não releu: fica como o pior caso a considerar, não como texto citado. Se a chave e o cliente OAuth forem do mesmo projeto do Google Cloud (fato 13; a confirmar no console), a suspensão atingiria também: a coleta do canal próprio (Analytics e Reporting), o envio e a edição de vídeos, o A/B Lab, o cadastro e a busca de canais, e o login do AdSense. Não há como estimar a probabilidade; este spec não a chama de baixa nem de alta.
- **O que mantém o risco baixo sem burlar nada.** (1) Ficar na cota padrão e **nunca pedir aumento** (é o pedido que dispara a auditoria); a seção 9 mostra folga de 68% mesmo com 200 canais. (2) Coleta em ritmo normal, pelas rotas documentadas, sem leitura de página fora da API. (3) Não redistribuir: nenhum dado de concorrente sai do painel do dono (nada público, nada vendido, nada em produto). (4) Registrar a cota gasta por dia (E1), para ver qualquer desvio. (5) Toda medida própria leva o aviso de que é cálculo do Observatório. **Nada disto é garantia de conformidade.**

**Dado de vídeo ou canal que saiu do YouTube: guardado por padrão.** A página lida não tem frase que mande apagar o dado quando o conteúdo é removido; tem o dever de coerência com o dado atual (III.E.4.e) e, no exemplo de III.E.4.b, o de verificar a cada 30 dias "that the video has not been deleted". A leitura prudente é que guardar o conteúdo de um vídeo que o autor apagou contraria III.E.4.e, e guardá-lo **sem prazo** é mais exposto do que a "lápide após 30 dias" que a v1 propunha.

- **Decisão do dono (12/10):** guardar tudo por padrão e decidir caso a caso, com confirmação manual (4.5). "Se o vídeo foi deletado por questão judicial e coisas assim a gente vai e apaga; agora se foi segredo revelado de como ter mais sucesso é bom a gente conseguir analisar."
- **O que isso significa na prática.** O sistema não sabe o motivo da saída (a API não diz), então **não consegue** separar sozinho o caso judicial do caso interessante: quem separa é o dono, olhando a fila. Enquanto ele não responde, o conteúdo de um vídeo removido, inclusive por ordem judicial ou por denúncia, continua guardado, com título, descrição e miniatura em URL pública no Blob. O risco cresce com o tempo que um item fica sem resposta; por isso a fila tem contador visível e cada item mostra há quantos dias espera. Não há prazo que apague sozinho: foi essa a decisão.
- **O que o desenho garante:** quando ele manda apagar, apaga de verdade, em todo lugar (banco, Blob, e os comandos para o arquivo no NAS), e o que resta é um id sem conteúdo.

**O arquivo fora do banco.** Exportar o dado de concorrentes e guardá-lo no NAS por anos é a mesma retenção além de 30 dias, em outro lugar: não muda o risco para melhor nem para pior, e continua sendo dado que não sai da casa do dono. O que muda é o dever de apagar: uma decisão de "apagar" (4.5) ou uma revogação alcançam também o arquivo, e lá só o dono escreve.

> **Emenda v2.1:** o "seguir" do dono acima foi dado para estatística e metadado público de canal e de vídeo. O ritmo por hora (E15) é estatística pública e entra nele (risco 25). **O texto de comentários de terceiros (E14) é outra coisa:** o dono decidiu o desenho de minimização (identidade apagada aos 28 dias), e os limites dele estão em 11.2, itens 19 a 23; o risco 20 espera a confirmação da pergunta 14.

### 11.2 Riscos abertos

1. **Plano gratuito × número de canais** (9.3): com 15 a 20 canais há anos de folga; a partir de 25 a 30 o sinal de limite passa a mandar. O arquivo desacelera o crescimento, não o zera.
2. **Pacote em cache de 2 MB** (fato 7): a série semanal pode estourá-lo; item de aceite 21.
3. **Tempo do cron com 75 canais:** 200 s por lote; item 22.
4. **Sondas de Short** (`short-classifier.ts`) fazem chamadas HTTP fora da API para classificar vídeos de 61 a 180 s; o inventário não as revisou. Pesam no risco 11.1 mais do que qualquer coisa nova desta fase. Ficam como estão nesta fase (padrão assumido, seção 13).
5. **Mudança de contagem de views de 24/08/2026** atravessa a série de canal; toda medida marca a janela, mas M3(a) e M8 só ficam limpas depois de 19/10 e 14/12.
6. **Interpolação em M1:** entre leituras diárias o erro é pequeno; no primeiro dia depende das leituras de 6 em 6 horas e de quando o vídeo foi descoberto. A tela mostra a distância entre as leituras usadas, e a marca gravada (MG4) guarda essa distância.
7. **Ao vivo × estreia:** a API não distingue os dois de forma documentada (NC); os dois ficam fora das medianas juntos.
8. **Dieta:** apagar 94 mil linhas em produção. Mitigado por P1 a P4, CSV fora do banco e ensaio local; o risco que resta é erro humano entre P3(i) e P3(iii).
9. **Miniaturas de terceiros em URL pública no Blob** (707 hoje), inclusive as de vídeos que saíram do YouTube enquanto esperam resposta na fila.
10. **Fuso:** a série de concorrentes é do dia de São Paulo; a do canal próprio, do dia do YouTube. Nenhuma tela desta fase soma as duas.
11. **M10 pode ser lida como medição.** É o risco de produto desta revisão: um selo "Estourou e parou" ao lado de um vídeo parece veredito. Mitigação: o texto obrigatório no corpo, as três condições com os números à vista, nenhuma nota, e os limiares conferidos contra vídeos reais antes de a leitura ir para Outliers. Se o mockup não conseguir deixar claro que é indício, a leitura não entra.
12. **A retenção pode só existir daqui para a frente** (caso B de 7.2): cada semana sem a E8 é uma leitura que não volta. A conferência de leitura é o primeiro passo de toda a fase por isso.
13. **O arquivo depende de uma pessoa e de uma máquina.** O export só protege se o dono copiar, conferir no NAS e confirmar; um lote "exportado" e nunca confirmado não libera espaço (por desenho) e pode ficar esquecido numa pasta local. Mitigação: o sinal de limite lista os lotes exportados e não confirmados. O NAS é uma cópia só: a segunda cópia (snapshot do TrueNAS, ou manter a pasta local até o lote seguinte) é escolha do dono, a registrar no runbook.
14. **Exportado não é "restaurável" até alguém restaurar.** O item de aceite 74 exige a ida e volta (exportar, recarregar numa tabela vazia, comparar linha a linha) antes de qualquer apagamento.
15. **Relatórios do canal próprio com prazo.** Os termos de pesquisa de 08/09 a 08/10/2026 só existem em relatórios que vencem na origem a partir de cerca de 07/11/2026, e 38 deles ainda não foram baixados (fato 17); o bruto do alcance por origem começa a ser apagado em abril de 2027. A E12 é a primeira etapa (seção 14) e o item de aceite 95 existe por isso.
16. **Duas coisas de 7.3 não estão confirmadas** e mudam o desenho: se a API dá país por dia numa consulta, e se o relatório em lote traz o termo pesquisado. Se a segunda for "não", os termos por dia **não existem em lugar nenhum** e a família fica só com os 25 maiores por período; a tela diria isso.
17. **Limiar do YouTube no canal pequeno:** com 36 views em 90 dias, quase toda origem e todo termo ficam abaixo do limiar e são omitidos. A E11 pode entregar tabelas quase vazias para o canal de hoje; o valor está no histórico e no dia em que o canal crescer.
18. **Relógio do cron do canal próprio:** hoje 200 s de tetos em 270 s; o passo novo e a retenção disputam o que sobra. O plano refaz a soma antes de ligar.

19. **(v2.1) Texto de comentário é dado pessoal de terceiros; apagar o nome aos 28 dias é pseudonimização, não anonimização.** O dono decidiu o desenho de minimização em 12/10 (4.6.6): nome, id do canal e foto do autor ficam 28 dias e são apagados; o texto fica. **O limite, dito sem suavizar:** (a) o texto continua podendo identificar quem o escreveu: o comentário segue público no YouTube, com o nome ao lado, e é localizável copiando uma frase na busca; o id do comentário, que fica guardado para conferir se ele ainda existe, leva direto a ele. Depois dos 28 dias o Observatório não **mostra** de quem foi, mas quem tiver o texto consegue descobrir. (b) O texto pode trazer dado sensível (saúde, religião, opinião política), nome de terceiros, telefone, e fala de menor de idade; nada disso é filtrado. (c) O comentarista não sabe que o texto foi guardado e não tem canal para pedir que seja apagado (o aparato de LGPD do site atende os usuários do site, não estas pessoas). (d) O texto fica sem prazo e vai para o arquivo no NAS (sem as colunas de identidade). (e) Durante os 28 dias, nome, foto e id de pessoas comuns estão no banco. **O que o desenho faz:** 12 por vídeo e não todos; identidade com prazo curto, rotina idempotente que falha em vermelho, e uma consulta que prova que não há identidade vencida (item 125); sem respostas de terceiros; sem o lote bruto; texto só para quem edita o site; nada em pacote de IA; nada público. Registrado como **desenho de minimização decidido pelo dono, sem parecer jurídico**: este spec não afirma que ele basta para a LGPD (a base que caberia é o legítimo interesse, art. 7º, IX, e o art. 7º, § 4º dispensa consentimento para dado tornado público pelo titular sem dispensar finalidade, necessidade e os direitos dele; a exceção de uso "exclusivamente particular e não econômico" do art. 4º, I provavelmente não vale para um painel que serve a um canal monetizado). **Comentário que o autor apagou no YouTube:** conferido nos marcos de coleta e levado à fila do dono (4.6.7); enquanto ele não responde, o texto de alguém que quis tirá-lo do ar continua guardado (pergunta 14).
20. **(v2.1) A regra dos 30 dias, agora com conteúdo gerado por usuário.** O dono aceitou guardar além de 30 dias **estatística e metadado público** de canal e de vídeo (11.1). Comentário é outra coisa: é conteúdo escrito por terceiros, "Non-Authorized Data" do mesmo jeito (III.E.4.d: apagar ou atualizar em 30 dias), e III.E.4.e pede que o guardado seja coerente com o que o YouTube mostra hoje. A página de políticas lida em 12/10 **não tem frase específica sobre comentários**; tem, nos princípios (II.4), "Don't store user data indefinitely". Guardar por anos o texto de um comentário que o autor já apagou é o caso mais exposto de todo o spec, mais que o vídeo removido de 11.1. O que pesa a favor continua sendo o de 11.1 (cota padrão, sem pedido de aumento, nada redistribuído), e nada disso é conformidade.
21. **(v2.1) Depois do marco 30 ninguém confere se o comentário ainda existe.** Um comentário apagado no dia 45 fica guardado como se existisse, para sempre, e a fila nunca o mostra. A reconferência mensal (pergunta 13) fecha isso ao custo de cerca de 3 unidades por canal por dia. Sem ela, a tela escreve em cada comentário "conferido pela última vez em dd/mm".
22. **(v2.1) A amostra pode enganar.** "Mais curtidos" é "os mais curtidos entre os 100 que o YouTube pôs na frente", por um critério que ele não publica; 12 comentários não representam o público (quem comenta é uma fração de quem assiste, e os mais curtidos tendem ao elogio, à piada e à polêmica). "O criador não respondeu" nunca é afirmável (respostas cortadas). M11 é um piso. Mitigação: a amostra dita no topo de toda tela, o ⓘ, e nenhuma frase de tela que generalize ("o público achou…").
23. **(v2.1) Texto de desconhecidos dentro do painel.** Conteúdo ofensivo aparece como veio; endereço e HTML dentro do texto nunca são executados nem viram link (item 116); e, se um dia o texto for lido por IA, é dado e não instrução (4.6.8). O critério "canal verificado" do dono **não é atendido** por nenhuma opção: as quatro da pergunta 9 são substitutos, e a tela não pode usar a palavra.

24. **(v2.1) O mapa de horas pode ser lido como "a hora em que as pessoas curtem".** Ele mostra quando o contador público mudou, lido de hora em hora, de vídeos de até 14 dias, em horário de São Paulo (4.7.6). Se o YouTube atualizar os contadores em lotes de várias horas, **a etapa entrega um mapa que não se deve mostrar**, e isso só se sabe depois de 14 dias de leitura (item 140). O pedido do dono pode ter como resposta honesta "para curtidas, sim, com esta margem; para views, não". Mitigação: o texto fixo no corpo, a cobertura à vista, a fase "depois" separada do lançamento, a fatia no lugar da soma, e a regra de não mostrar o contador que anda em degraus.
25. **(v2.1) Leitura 24 vezes por dia e mais uma medida derivada guardada sem prazo.** O mapa é dado derivado de contagens de terceiros (III.E.4.h) e fica guardado além de 30 dias, como as séries: entra no risco de 11.1 sem mudá-lo de natureza, mas aumenta a frequência de leitura do projeto. A cota fica longe do teto no padrão (9.5); a opção de descoberta horária é a única que a aproxima dele.
26. **(v2.1) Mais um cron, de hora em hora.** É o 50º do projeto na Vercel. Os riscos conhecidos: agendar em dois lugares (não se cria job de `pg_cron`; item 141); a trava em memória de `src/lib/logger.ts`, que não protege entre instâncias (o plano usa a do banco); e execução pulada, que vira buraco medido e não erro escondido. A E15 também muda a E2: as primeiras 72 horas passam a ter 24 leituras por dia, e a tabela `competitor_video_early` cresce seis vezes (9.5).

## 12. Fora do escopo, registrado (para o dono poder reabrir)

### 12.1 O que ficou fora

Na v1 o canal próprio estava fora ("talvez não seja necessário adicionar mais informações além das que já coletamos"). **Em 12/10 o dono mudou isso**, e entram: o bruto de todos os relatórios em lote (R2 do inventário; seção 7.4), a curva de retenção (R1; 7.2) e as famílias de origem de tráfego, termos de pesquisa, dispositivo, país e inscrito, em tabelas e com retroação (R3 e R6; 7.3). O que continua fora:

| # | Etapa do inventário | O que daria | O que expira enquanto não for feita |
|---|---|---|---|
| R4 | E2 ampliada: métricas que faltam no diário (descurtidas, salvos em playlist, cliques de cartão), canal por dia, contadores públicos por dia | o total do canal com vídeos apagados; curtidas públicas com data | só os contadores públicos por dia (a Data API só dá o de agora); o resto a Analytics API devolve para trás |
| — | **Demografia** (idade e gênero) em tabela e em tela | perfil de quem assiste | nada: por período a API retroage, e o "por dia" passa a ficar guardado em bruto pela E12 |
| — | Tabela e tela para o resto do bruto da E12 (cartões e telas finais por elemento, legendas, o cruzamento das dimensões, local de reprodução, compartilhamento) | detalhe por elemento e cruzamentos | nada: o bruto fica guardado |
| R5 | E5: estado diário do vídeo e do canal próprios | histórico de categoria, idioma e afins | a data de cada mudança. Ressalva da política: é dado autorizado que **não** é estatística, e por III.E.4.c segue a regra de apagar ou atualizar em 30 dias (fato 16) |
| R7 | E8: limpar zeros falsos legados (`youtube_video_analytics.impressions` e `ctr` em 0) | fecha um "zero nunca medido" | nada |

Também fora: tudo de 3.3 e 3.4; entidade "criador"; chat; qualquer mudança no kit da forja.

### 12.2 Fases seguintes (specs à parte)

1. **Fase de manutenção de dados, com NAS e forja: o dono pretende fazê-la na semana que vem.** Instalar o banco no NAS, carregar os exports, arquivar por idade de verdade e o botão "Ver antigo" (descritos em 9.2). É spec próprio. Com isso a folga do plano gratuito (9.3) deixa de mandar na ordem desta fase; o número fica como informação e o sinal de limite, como item de aceite (80).
2. **TikTok.** Ele quer para o TikTok algo similar ao que existe para o YouTube. É **um spec à parte**, precedido de uma verificação de viabilidade de acesso a dado: o que a conta própria consegue ler por API oficial, e o que existe (ou não) para contas de terceiros. Nada desta fase prepara ou depende disso.

## 13. Perguntas ao dono (as que continuam abertas; cada uma com o padrão assumido e o que trava)

Já respondidas e fora da lista: o plano do banco (gratuito); a triagem (aprovada); o que saiu do YouTube (guardar, decidir caso a caso); o canal próprio (entram o bruto de todos os relatórios em lote, a retenção e as cinco famílias em tabelas); a etapa de mockups (existe, E13); as fases seguintes (manutenção com NAS na semana que vem; TikTok em spec próprio).

1. **Playlists (E3): entram?** Padrão: sim, depois de E1 e E2, se a cota medida ficar abaixo de 2 unidades por canal e dia. Trava: a migration MG3 e a "Linha do tempo" com playlists.
2. **Idade de corte do dado online.** Padrão: **12 meses**, com envio ao NAS em lotes semestrais, e sugestão de arquivar o canal que ficar 12 meses sem publicar. A alternativa de 6 meses economiza cerca de 2,3 MB por canal e faz toda tela de "último ano" depender do "Ver antigo" (9.2 e 9.3). Trava: o spec da fase de manutenção, que o dono quer fazer na semana que vem.
3. **Retroação do canal próprio: até a publicação de cada vídeo (2015)?** Padrão: sim, tudo o que a API devolver; custa cerca de 7 MB uma vez e algumas centenas de consultas espalhadas em dias. A alternativa é só os últimos 2 anos (cerca de 1 MB). Trava: o comando de retroação da E11.
4. **O defeito do contêiner da comparação (T0) pode ser consertado já, fora do "só planejamento" da A3?** Padrão: sim, é defeito em produção e não depende de desenho. Trava: a ordem da E5.
5. **A chave de API e o acesso autorizado são do mesmo projeto do Google Cloud?** É verificação, não opinião. Como fazer: o número antes do primeiro hífen de `GOOGLE_CLIENT_ID` (que não é segredo) é o **número do projeto** do cliente OAuth; no console do Google Cloud, em "APIs e serviços → Credenciais", abrir a chave de API usada em `YOUTUBE_API_KEY` e ver de qual projeto ela é; o número desse projeto está em "Painel → Informações do projeto". Números iguais = mesmo projeto. Na mesma visita, anotar a cota diária da Analytics API (conferência 4 de 7.3). Padrão assumido: mesmo projeto (o dono afirma). Trava: nada; só muda o tamanho do pior caso de 11.1 (com projetos separados, uma suspensão por causa dos concorrentes não levaria junto o canal próprio, o envio de vídeos e o AdSense).
6. **Limiares.** Promoção para a série diária (1.000 views e 5% numa semana); "subida" (2× e 1.000 views em 7 dias); "Estourou e parou" (V30 ≥ 2× a mediana, cauda ≤ metade da mediana e ≤ 2% nos últimos 28 dias, reação ≤ metade da mediana). Padrão: esses, conferidos contra vídeos reais quando houver. Trava: nada; cada um é um número em `rules.ts`.
7. **Buscar o catálogo inteiro dos canais (6.089 vídeos, hoje 1.389 guardados)?** Padrão: não; a série semanal cobre só o que já está guardado. Trava: o volume (quadruplica a parcela que mais cresce, 9.3).
8. **Como o site vai alcançar o NAS para o "Ver antigo"?** Recomendação: a casa puxa, como a forja (opção A de 9.2). Trava: nada desta fase; é a primeira decisão do spec da fase de manutenção.

**Perguntas da emenda v2.1 (comentários de destaque, 4.6).** As de número 9 e 10 travam a migration MG8; as outras têm padrão e não travam; a 15 já foi respondida.

9. **"Canal verificado" não existe na API. Qual substituto?** (4.6.2) **A:** o autor é um canal que o Observatório acompanha (custo zero, nenhum dado novo de terceiros, raro). **B:** o autor tem muitos inscritos (até 2 unidades por vídeo e marco; busca o número de inscritos de até 100 pessoas por vídeo; precisa de um limiar). **C:** A, mais B só para os autores dos 20 mais curtidos. **D:** abandonar o critério e dar as vagas aos mais curtidos. O spec não escolhe; a regra está escrita com a vaga vazia (igual a D) e o custo contado com A. Trava: o significado de `featured_reason` e a frase da tela.
10. **A divisão dos 12.** Proposta: até 4 "com o criador" (ele escreveu ou respondeu), até 2 "autor de destaque" (conforme a 9), e o resto "mais curtidos" (no mínimo 6; vaga que sobra vem para cá). O dono deu os critérios, não os números. E o alvo fica em 12? Trava: os parâmetros da regra.
11. **Gastar cota para saber com certeza se o criador respondeu?** A API devolve só parte das respostas de uma conversa. Padrão: **não** (0 chamada a mais; onde as respostas vieram cortadas a tela diz "não se sabe"). Alternativa: até 3 chamadas a mais por vídeo e marco, para as conversas mais curtidas com respostas cortadas (até +2,4 unidades por canal por dia). Trava: nada.
12. **Alcance: Shorts entram? E os 1.389 vídeos já guardados ganham um retrato de hoje?** Padrão: Shorts **sim**, com a mesma regra (são 61% dos vídeos); retroação **não** (só vídeos que fizerem 1, 7 ou 30 dias depois do deploy). A retroação custa 1.389 unidades uma vez e cerca de 0,6 MB por canal, e daria comentários para ler já na primeira semana, em vez de só dos vídeos novos. Trava: nada.
13. **Reconferir todo mês se os comentários guardados ainda existem?** Padrão: **não** (conferência só nos marcos 7 e 30; risco 21). Alternativa: uma conferência a cada 30 dias, por 12 meses depois da publicação do vídeo (cerca de +3 unidades por canal por dia). **O autor deste spec recomenda a alternativa** se a resposta à 14 for "guardar": é o que mantém a fila fiel ao que o YouTube mostra. Trava: nada.
14. **O que fazer quando um comentário deixa de vir do YouTube?** (i) vai para a fila "Saíram do YouTube", agrupado por vídeo, e fica guardado até você decidir, como os vídeos (é o padrão proposto em 4.6.7, por ser a regra que você deu); ou (ii) **o texto é apagado sozinho**, sem pergunta, e fica só o registro de que existiu. O argumento de (ii): o vídeo removido é obra pública de um criador que você estuda; o comentário apagado é de uma pessoa comum que quis tirá-lo do ar, e o risco 19 mostra que tirar o nome não o torna anônimo. Junto: confirmar que o risco 20 (regra dos 30 dias com conteúdo de usuário) entra no "seguir" de 11.1. Padrão: (i). Trava: o item de aceite 118 e o mockup 10.
15. **Respondida em 12/10:** nome, id do canal e foto do autor ficam 28 dias e são apagados; o texto fica (4.6.6). O prazo é o parâmetro `commentsIdentityDays`.
16. **Leitura do texto por IA (tema, tom, pedido)?** Não é desta fase. Fica registrada como opção (4.6.8), com a diferença entre a forja (modelo local, o texto não sai de casa) e o Cowork (modelo na nuvem). Padrão: nenhum texto de comentário em pacote nenhum. Trava: nada.

**Perguntas da emenda v2.1 (ritmo por hora, 4.7).** Nenhuma trava a migration MG9; todas têm padrão.

17. **De quanto em quanto tempo ler?** Padrão: **1 hora**. 30 minutos dobra a cota da etapa e a curva de 72 horas (mais 0,75 MB por canal por ano) e só rende se o contador andar mais de uma vez por hora; 2 horas corta os dois pela metade e ainda responde "21 às 23 contra 3 às 5", mas borra a curva de lançamento. Sugestão: começar em 1 hora e decidir com a medição do item 140.
18. **Mapa por mês ou por semana?** Padrão: **mês** (0,25 MB por canal por ano). Por semana custa cerca de 1,1 MB e cada casa teria uma amostra só.
19. **Descobrir vídeo novo de hora em hora?** Padrão: **não** (a descoberta segue a de hoje, até 6 horas depois da publicação, e a curva de lançamento começa aí). Sim custa 24 unidades por canal por dia (360 com 15 canais, 1.800 com 75) e faria a curva começar na primeira hora, que é onde ela mais informa.
20. **Limiares e janela.** Vídeos de até 14 dias, até 25 por canal; fatia só com 200 views, 20 curtidas ou 10 comentários no dia; mapa medido com 28 dias de vídeo e 3 vídeos; hora a hora por 72 horas (reduzir para 24 horas economiza cerca de 0,25 MB por canal por ano). Padrão: esses, conferidos contra os dados reais depois de 14 dias. Cada um é um número em `rules.ts`.

Padrões assumidos sem pergunta (o dono troca se quiser): as miniaturas continuam em URL pública no Blob; as sondas de Short ficam como estão; a retenção é coletada só para o público orgânico; país e inscrito são gravados por vídeo (não só por canal); o nome de tela de M10 fecha no mockup; M10, a retenção, os termos de pesquisa e os sites externos não vão para o Cowork nem para a forja; **(v2.1)** comentários são lidos nas idades 1, 7 e 30 dias do vídeo, o texto é cortado em 2.000 caracteres, só as respostas do criador são guardadas (até 3 por conversa), e o texto só é visto por quem edita o site; a foto do autor é guardada como URL, sem cópia; no ritmo por hora, diferença negativa fica fora do mapa e é contada à parte, intervalo com buraco nunca é dividido, o mapa é em horário de São Paulo, e os canais do dono entram como canais acompanhados para serem lidos pela mesma amostragem.

## 14. Sequência proposta

**Quinze etapas** (E1 a E15; a E14 e a E15 são a emenda v2.1). A lógica da ordem: **primeiro o que para de perder dado**, depois o resto da coleta, depois os mockups, e só então código de tela. Cada etapa vai à produção sozinha, com CI verde; push e promoção são do agente; migration e qualquer comando em produção são do dono; nenhuma escrita na forja nem no NAS. A fase de manutenção (NAS) e o TikTok são specs à parte (12.2).

| Ordem | Etapa | Migration | Espera mockup? | Depende de |
|---|---|---|---|---|
| 1 | **E12: ligar os 10 relatórios em lote e guardar o bruto**, com os dois tetos; junto, as conferências de leitura da retenção (7.2) e da E11 (7.3) | não | não | nada. **Tem data:** os relatórios de histórico já na fila vencem a partir de cerca de 07/11/2026 |
| 2 | **E6 (P1 e P2): dieta, parte aditiva** | sim (cobertura, já com os conjuntos da E11) | não | nada |
| 3 | **E1: campos, sinalizadores, `raw`, e a marcação do que saiu do YouTube** | sim (MG1) | não | nada (a triagem está aprovada) |
| 4 | **E2: série** | sim (MG2) | não | E1 (reusa o escritor) |
| 4b | **E14: comentários de destaque** (4.6): primeiro a chamada de leitura (item 107), depois a coleta, já com a rotina que apaga a identidade aos 28 dias | sim (MG8) | só a tela (mockup 20) | E1 (o sinalizador de comentários desligados, `discovered_at`, o registro de cota) e E2 (o passo diário e as idades); **as respostas às perguntas 9 e 10**. Perde dado todo dia (o retrato de 1, 7 e 30 dias de cada vídeo novo não volta). As medidas M11 e M12 entram com a E4 |
| 4c | **E15: ritmo por hora** (4.7): leitura horária, curva de 72 horas, mapa por mês | sim (MG9) | só a tela (mockup 21) | E2 (a tabela das primeiras horas e a lista de vídeos com idade). **Perde dado todo dia** e não depende de resposta do dono: pode ir logo depois da E2. O que se mostra só é decidido depois de 14 dias de leitura (item 140). As medidas M13 e M14 entram com a E4 |
| 5 | **E8: coleta e leitor da retenção** | sim (MG5) | só a tela (mockup 11) | a conferência de leitura. **No caso B sobe para junto da ordem 2** |
| 6 | **E11: canal próprio em tabelas** (normalizadores, coleta diária, retroação) | sim (MG7) | só as telas (mockup 12) | as conferências; E6 P1 (a tabela de cobertura); o bruto da E12 |
| 7 | **E6 (P3): apagar as linhas vazias**, com o dono | sim | não | 3 execuções limpas de P2 |
| 8 | **E3: playlists** | sim (MG3) | não | pergunta 1 |
| 9 | **E10: export com conferência e sinal de limite** | sim (MG6) | só o aviso na tela (mockup 18); os comandos e o sinal no retorno do cron, não | nada; o ensaio com o dono (item 82) pede um canal que ele queira remover. Convém fechar antes da fase de manutenção, que usa o export |
| 10 | **E4: medidas e marcas** | sim (MG4, marcas) | não (funções e testes) | E2 para M1; M3(a), M4, M6 e M8 "parado" podem começar já; M10 fica pronta e sem dado até 2027 |
| 11 | **E13: fazer, revisar e validar os mockups** (6.5): `frontend-design` desenha, `revisor-ux-senior` cobra, o dono aprova, um por vez | não | é a própria etapa | começa já pelos 9 que existem e pelo mockup 10; os de 11 a 17 pedem o dado das etapas acima |
| 12 | **E9: fila "Saíram do YouTube"** (a função de apagar pode ir antes; a tela, depois do mockup 10) | não (as colunas e a tabela estão na MG1) | **sim** (mockup 10) | E1 |
| 13 | **E5: telas** (T0 primeiro, sem mockup) | não | **sim, cada tela com o seu** | E4; E13 |
| 14 | **E7: Cowork** | não | não | E4 |
| 15 | **E6 (P4): apagar o backup** | sim | não | 14 dias depois de P3 |

**O que a ordem protege.** O que vence: a E12 não tem migration nem desenho e é a primeira. A folga de espaço **não manda mais na ordem**: o dono pretende fazer a fase de manutenção na semana que vem, e mesmo sem ela nenhum cenário realista cruza 500 MB antes de 17 meses (9.3). A dieta continua nesta fase e cedo, porque é o que mantém as telas da A4 leves e porque a tabela de cobertura dela é reusada pela E11.

**Podem ser planejadas e executadas já, sem esperar desenho:** toda a coleta (E12, E1, E2, E3, E8 e E11, sem as telas; a E14 e a E15 também não esperam desenho; a E14 espera as respostas do dono às perguntas 9 e 10), as medidas como modelo puro e as marcas (E4), a dieta do diário (E6), o export com o sinal de limite (E10), a parte de servidor da E9 (marcar, apagar, registrar), o Cowork (E7) e o T0. A ordem entre E1 e E2 segue "o que se perde por dia": as duas perdem todo dia; a E1 vem antes por custar zero de cota, ser só acréscimo e dar à E2 o escritor de `raw` que a passada semanal usa. As duas cabem na mesma semana.

**Esperam mockup aprovado (E13):** toda a E5 menos o T0, a tela da fila (E9), a seção de retenção com dado real (E8), as seções do canal próprio (E11) e o aviso de limite na tela (E10). Os 9 mockups de 12/10 aguardam aprovação; faltam os de 10 a 19, na ordem de 6.5. A skill `frontend-design` faz todos; o `revisor-ux-senior` cobra cada um antes do dono, inclusive os 9 que já existem; o dono aprova um por vez; o "Ver antigo" é só esboço.

**Como se junta à A4 (12 de 17 tarefas feitas localmente).**

- A A4 continua como está: as Tarefas 13 e 14 esperam a aprovação dos mockups de `2026-10-12-a4-proprio-e-ajustes/`; a 15 fecha a semente.
- **A dieta toca o leitor da A4** (`lib/proprio/ler.ts`) e a semente e2e. Para não haver dois agentes no mesmo arquivo: a parte de código da E6 (P2) só começa depois de a A4 fechar o lote e ir a `staging`, ou é feita pelo mesmo implementador. P1 (migration aditiva) não toca código da A4 e pode ir antes.
- **A retenção (E8) e as famílias do canal próprio (E11) acrescentam leitores em `lib/proprio/` e seções nas páginas do vídeo e do canal próprios**, que a A4 entrega dizendo "não coletada" e "O que ainda não é medido". A coleta e as migrations não tocam arquivo da A4; as seções das telas só são trocadas depois de a A4 ir a `staging` e de os mockups 11 e 12 serem aprovados. Os leitores novos usam o mesmo token de edição (`edicao.ts`), sem mudá-lo.
- Os ajustes da A3 (seletor, trocas, base e direção, defeito do contêiner) estão "só em planejamento" por decisão do dono: **passam a ser a E5 desta fase**, na ordem de 6.5; a Tarefa 16 da A4 (cortar o painel) fica suspensa até ele decidir o conflito com C2.
- A Tarefa 14 da A4 ("Só o seu canal mede") e a comparação da E5 mexem na mesma tela: a E5 começa nela depois da 14.
- E1, E2, E4, E9 e E10 não tocam nenhum arquivo da A4 (são `competitor-sync.ts`, `series.ts`, `load.ts`, `pack.ts` e arquivos novos) e podem correr em paralelo.
