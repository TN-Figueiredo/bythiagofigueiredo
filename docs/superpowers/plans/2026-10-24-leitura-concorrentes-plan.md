# Leitura dos concorrentes pelo título exibido (regra v2 da T13): plano de implementação

> **Para agentes executores:** sub-skill obrigatória: superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**r2.1, 24/10/2026.** Aplica os achados da r1 de Phil (dados, nota 84), Yannis (software, nota 84) e Hanna (PO, SIM com 2 correções) e as emendas finais da r2 (Phil 93 SIM, Yannis 92 SIM, com ressalvas; Hanna de acordo). O mapa achado → onde entrou está no fim ("Registro r2" e "Registro r2.1"). Sem nova rodada de revisão, salvo divergência.

**Objetivo.** Trocar a regra v1 do observador de concorrentes pela regra v2, que lê `titulo_exibido` da leitura bloqueada (envio A, com a flag off), e expor a leitura ao Cowork pelo domínio `youtube` da pipeline e pela tool MCP `youtube_observatory` (envio B).

**Arquitetura.** A regra continua pura em `observados/inferir.ts`: ela agrupa as leituras por rodada e decide por janelas (W, W₋₁, W⁻), como o protótipo `prototipo/replay_v2_mistas_hist.py`. Dois módulos puros novos, `guarda.ts` e `alarme.ts`, levam a lógica da guarda §6.2 e do alarme §6.1. **A gravação (linha + cursor) é uma função única, `gravacao()` em `inferir.ts`, usada por `passo.ts`, pelo ensaio a seco e pelos testes; a leitura de volta é `lerLinha()`/`lerCursor()` em `estado-de-leitura.ts`, usada pelo ensaio e pelo serviço do envio B.** O I/O fica em `passo.ts`, em `paginar.ts` e num `avisos.ts` novo do observador, ligado como mais uma parte de `rodarAvisos`. A leitura (`estado-de-leitura.ts` + `textos.ts`) é a única fonte do texto.

**Stack.** TypeScript 5 strict, Vitest, Supabase JS (PostgREST), Next 16 (rota da pipeline), MCP SDK.

**Spec:** `docs/superpowers/specs/2026-10-24-leitura-concorrentes-design.md` (r2.1, com acordo). O executor lê o spec inteiro antes da 1ª tarefa; o plano cita os parágrafos por número (§).

**Evidência** (fora do repo, só leitura): `/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/leitura-concorrentes/` — `replay-23-10.csv`, `rotulos-23-10.md`, `replay-resultado-mistas-hist-23-10.md`, `prototipo/replay_v2_mistas_hist.py`, `yannis-export-replay.sql`. Abaixo, `$EV` = essa pasta.

## Restrições globais

- Worktree **`/Users/figueiredo/Workspace/bt-leitura`**, branch `trabalho/leitura-concorrentes`. Nada fora dele.
- **Sem migration.** Sonda, watch e banco não mudam (§1, §12). As colunas usadas já existem: `yt_watch_readings.titulo_exibido`, `idioma`, `rodada_id`; `competitor_videos.competitor_channel_id`; `notifications.dedup_key`/`expired_at`.
- Flag `OBS_TROCAS_CONCORRENTE` (só `'on'` liga; `flag.ts` não muda). O envio A vai com ela **off**.
- Nenhuma tarefa faz push, deploy, seed em produção nem `db:push` (o controlador cuida).
- Constantes do spec, com estes valores: `OBS_REGRA_VERSAO = 2`, `W_RODADAS = 8`, `MIN_RODADAS_TITULO = 6`, `MIN_RODADAS_MINIATURA = 4`, `SPAN_MAX_H = 72`, `FRESCOR_H = 9`, `MIN_RODADAS_MISTAS_HIST = 2`, `ALFA = 0.0005`, `Q_TRAVA = 0.999`, `PERIODO_MIN_RODADAS = 16`, `CARENCIA_H = 24`, `TETO_VERSOES = 8`, `APRENDENDO_DIAS = 4`, `JANELA_DIAS = 30`, `DHASH_MIN_TROCA = 10`, `TETO_ITERACOES_GUARDA = 3`, `TETO_LINHAS_GUARDA = 1000`, `LIMIAR_SEM_TITULO = 0.20`, `LIMIAR_ALVOS_SEM_LEITURA = 0.10`, e **`CADENCIA_H = 6`** (cadência da sonda, usada por D-P2; exportada junto de `FRESCOR_H`, com comentário do acoplamento com o §3.2).
- `PADROES_DETECCAO`, `classificarTitulo` e as fixtures do próprio canal ficam **intocados** (§3.3).
- Textos ao dono: os do §11 e do §6.1, **copiados sem reescrever**. "teste" de estado de teste vem sempre com "possível", nunca "venceu", e a contagem é em passagens, nunca em %.
- Testes: `// @vitest-environment node` em todo arquivo novo. Relógio relativo ou fixo, nunca ano futuro hardcoded no meio da lógica (regra anti-regressão). A fixture real é de 23/10/2026 e usa a data dela.
- Saída de teste sempre para arquivo; no contexto, só `tail`. Nenhum comando espera mais de 4 min em primeiro plano.
- `pureza.test.ts` do observador lista os arquivos do diretório: todo arquivo novo em `observados/` entra na lista dele (puro) ou no `SERVIDOR` (I/O).
- **Árvore verde a cada commit (Yannis I1).** O pre-commit roda `npx tsc --noEmit` no web (`src/` inteiro; testes ficam fora do `tsc`). Toda tarefa termina com `cd apps/web && npx tsc --noEmit > /tmp/leitura-Tn-tsc.log 2>&1` **vazio**, e **nenhum commit usa `--no-verify`** nas tarefas T1–T11 e B1–B2. Um símbolo só sai na tarefa que remove o último consumidor dele; a tabela abaixo ("Sequência de remoção") manda. Nenhum `describe.skip`/`it.skip` fica de um commit para o outro, exceto o caso expressamente previsto na T3.
- **Corte de texto por ponto de código** (Phil M3), nunca `slice` em unidades UTF-16: `Array.from(s).slice(0, n).join('')`. Vale para os 300 caracteres de `ref`/`titulo` e os 80 dos textos. Motivo: o `jsonb` recusa surrogate solto, o upsert falha e o alvo volta à fila a cada disparo.
- Commits: `tipo: descrição curta` + `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

### Sequência de remoção (cada linha é uma tarefa, cada commit compila)

| Tarefa | O que acontece com os símbolos da v1 |
|---|---|
| T1 | `LeituraObs` **ganha** `tituloExibido: string | null` e **mantém** `tituloOficial`/`tituloFonte`. `fabrica.ts` ganha `tituloExibido: 'Titulo A'` e mantém os antigos. `passo.ts`: só `titulo_exibido` no `select` e `tituloExibido: texto(l.titulo_exibido)` no mapeamento (2 linhas). Sem `skip`. |
| T2 | Só **acrescenta** as funções novas. A v1 (`inferirCampo`, `corridas`, `corridaCabivel`, `ESTAVEL_*`, `MIN_PASSADAS_INICIAL`, `TETO_CORRIDAS`, `TETO_BYTES_CORRIDA`) fica intacta e seus testes passam. |
| T3 | Troca `inferirObservadoDetalhe` pela v2, **remove** a v1 e os campos `tituloOficial`/`tituloFonte`, e no **mesmo commit** ajusta `passo.ts` (tira `alvoSaiu`/`saiuPor` da chamada e o mapeamento antigo, só o necessário para compilar). `VALIDAS_MIN_MEDIDO` fica exportado como **literal `= 4`** (a `2 * MIN_RODADAS_CORRIDA` sai com a v1, e o `tsc` falharia) com `/** @deprecated: sai na T7 */` (Yannis R4). **Na T3, o `mundo()` do `passo.test.ts` passa a emitir `titulo_exibido` (mecânico, uma função) e só se pulam os casos cujo conteúdo depende da v1; meta ≤ 5 `skip`, listados na mensagem do commit** (Yannis R6). Testes de `passo.test.ts` que dependem da v1 e quebrarem mesmo assim: `it.skip` com `// v1: reescrito na T6`, único `skip` permitido; a T6 os reescreve e a T11 confere que não sobra nenhum. |
| T6 | `passo.ts` troca `< VALIDAS_MIN_MEDIDO` por `=== 0`. |
| T7 | `estado-de-leitura.ts` deixa de importar `VALIDAS_MIN_MEDIDO`; a constante é apagada. |
| T11 | `grep -rn "describe.skip\|it.skip" apps/web/test/youtube/teste-youtube/observados` sai vazio. |

## Preparação do worktree (uma vez, antes da T1)

O worktree não tem `node_modules`. Em background, com saída em arquivo:

```bash
cd /Users/figueiredo/Workspace/bt-leitura && (npm ci && npm run build:packages) > /tmp/leitura-prep.log 2>&1; echo FIM >> /tmp/leitura-prep.log
```

Pronto quando `tail -3 /tmp/leitura-prep.log` mostrar `FIM` sem `ERR!`. Para conferir: `cd apps/web && npx vitest run test/youtube/teste-youtube/observados > /tmp/leitura-base.log 2>&1; tail -5 /tmp/leitura-base.log` mostra a suíte atual verde.

**Amostra real da CLI (controlador, antes da T1; Phil I5).** A CLI instalada (v2.98.2) devolve JSON com envelope de aviso quando detecta agente. O controlador gera uma amostra de 3 linhas e a deixa em `apps/web/test/youtube/teste-youtube/observados/fixtures/amostra-cli.json`: `npx supabase db query --linked --agent=no -o json "select … limit 3" > …/amostra-cli.json` (mesmas colunas do `obs-dry-run.sql`, embrulhadas em `json_agg`). Só leitura. Sem a amostra, a T1 não fecha o teste do `extrairLinhas`.

## Decisões do plano (o spec deixa abertas; a revisão r1 concordou, com as condições abaixo)

- **D-P1. `ficou.transicao`.** O spec (§11, Troca) pede "entre 20/10 13h e 19h", e a forma de `ficou` do §4 não carrega esse intervalo. Os dois campos ganham `transicao: { antes: string; de: string; ate: string } | null`. **`de` = a última vista de Y contando blips (é o mesmo ponto de onde R é contado); `ate` = a 1ª rodada de X depois disso.** É não nula só em `troca`. O texto da miniatura ("trocada em 21/10") usa `ate`. JSON aditivo, sem migration, e entra no teste de < 4 KB.
- **D-P2. `sem_troca_vista.desde`, com trava (Phil M10, Hanna 4, Yannis).** O cursor não guarda o início de W. `desde = avaliadoEm − (W_RODADAS − 1) × CADENCIA_H`, e o texto mostra só o dia ("desde 21/10"). Com rodada faltando a data sai mais tarde que o início real (afirma menos); fica otimista se houver duas rodadas em menos de 6 h, e com sonda irregular o dia pode adiantar 1 a 2 dias (span de W até 72 h). **Dívida declarada** (comentário junto de `FRESCOR_H` e linha no ledger; gatilho: a cadência mudar, ou o dono apontar a data errada). **Trava:** um teste afirma `CADENCIA_H === 6` e falha com a mensagem "a cadência da sonda mudou: revisar `desde` (D-P2) e `FRESCOR_H`"; se a sonda exportar a própria cadência (o executor confere por grep), o teste compara com ela, e não com o literal.
- **D-P3. Alvo que saiu fecha a linha, não a descarta (Yannis M1, decisão do controlador).** Com `a.saiuEm !== null`, `passo.ts` grava a linha que a regra emitir, mas com `ficou_estado` forçado a `sem_desfecho` e `motivo = saiuPor` quando o estado for `em_andamento` ou a miniatura indeterminada (o mesmo que a varredura faz, §4 linha "fechamento atual"); linha `estavel` sai como está. Nada reabre, porque a linha nunca é gravada como `em_andamento`; e a leitura (§5 passo 2) mostra "Fora da observação… Último estado: …" com o estado que a sonda viu. O cursor é gravado sempre. Quem faz isso é `gravacao()` (D-P7).
- **D-P4. Leitura do idioma majoritário.** O protótipo não filtra o idioma. A cópia com o filtro do §3.1 (`maioria`, empate para o mais recente) sobre o mesmo CSV deu **0 divergências em 35, contagens iguais**. Mas a prova é vazia (Phil): as 9.795 leituras são `pt-BR` ou nulas. Quem prova o filtro é a semente de 2 idiomas da T2, que cobre a maioria, o empate 9×9 para o mais recente **e** o idioma nulo, que nunca vota. A `maioria` é calculada **depois** de tirar os suspensos (suspenso = inválido, §3.1).
- **D-P5. Resumo do envio B.** A linha de resumo (§7, Envio B, 1) conta vídeos **pelo título**; *sumindo* conta em "com possível teste em andamento". A miniatura entra numa 2ª linha: "Miniatura: Z trocas, K alternando sem dar para afirmar troca." **Concordância (Hanna 5):** singular com 1 ("1 troca", "1 não medido", "1 vídeo…observado", "1 provavelmente terminado"), plural no resto, numa função do texto com teste. **Canal com `removal_requested_at` é excluído da resposta e da contagem N** (Phil M9). N = alvos com `saiu_em is null` e publicação conhecida; `fora_da_janela` não entra em N (é alvo que saiu) e vai num campo próprio.
- **D-P6. Rota do envio B.** `GET /api/pipeline/youtube/competitors/observed`, ação MCP `get_observed`. O caminho `/competitors/` já liga o endpoint à tool `youtube_observatory` em `auto-register.ts:134`.
- **D-P7. Gravação única (decisão do controlador; Yannis I5).** `gravacao(e: { r: ResultadoObs; estourou: boolean }, o: { agoraIso: string; rodadas: number; saiuPor: string | null }): { linhas: LinhaGravada[]; cursor: CursorGravado }`, pura, em `inferir.ts`. `LinhaGravada` = o objeto do upsert sem `site_id`/`youtube_video_id`, em snake_case como no banco; `CursorGravado = { avaliado_ate_rodada; avaliado_em; avaliado_motivo: 'ok' | 'sem_publicacao'; validas_titulo; validas_miniatura }` (`validas_* = 0` quando `estourou`). **A coluna é `avaliado_motivo` (migration `20261021000006_ab_native_observados.sql:46`), não `motivo`** (Yannis R1; `motivo` é da tabela de linhas). **O cursor `sem_publicacao` também sai de `inferir.ts`:** `cursorSemPublicacao(o: { agoraIso: string; rodadas: number }): CursorGravado` (`validas_* = 0`, `avaliado_motivo: 'sem_publicacao'`), e `passo.ts` (`gravarCursor`, hoje `passo.ts:197-205`) usa só `gravacao` e `cursorSemPublicacao` (Phil M-a = Yannis R3). **`saiuPor` é decidido pelo chamador por `saiuEm`:** `passo.ts` passa `saiuPor: a.saiuEm !== null ? (a.saiuPor ?? 'saiu') : null` (Yannis R2). `ResultadoGuardado` (T5) tem a forma de `e`, então não há importação circular. `passo.ts` só acrescenta `site_id`/`youtube_video_id` e grava; o ensaio e os testes chamam a mesma função. Na volta, `estado-de-leitura.ts` exporta `lerLinha(row: Record<string, unknown>): LinhaLida | null` e `lerCursor(row): CursorLido | null` (lê `avaliado_motivo` e devolve `motivo` em `CursorLido`); o serviço do B e o ensaio os usam (o ensaio faz `lerLinha(gravacao(...).linhas[i])`, a ida e volta pelo formato do banco).
- **D-P8. Canal nulo na guarda (Phil M2 × Yannis M3, conciliados).** Canal nulo **dos dois lados** (alvo e achado) = canal desconhecido: a regra de "outro canal" não dispara, vale só "≥ 2 outros vídeos" e o teto (é o caso da fixture, que não tem canal). Canal nulo **de um lado só** = canal diferente (conservador: suspende). Teste nos dois casos. Revisão pode recusar.

## Chave por pessoa (§7, Envio B): conferido no código, **o caminho não existe hoje**, e o Claude Code já usa a chave permanente

- Existe a **criação** da chave por pessoa: perfil `observatorio_leitura`, colunas `user_id` e `expires_at` em `pipeline_api_keys` (migration `20261014000003`), o comando do dono `apps/web/scripts/observatorio-acesso.ts criar --usuario <e-mail>`, e `acesso-ia/{porta,registrar,taxa}.ts`.
- Essa chave, porém, **não lê nada**. Em `/api/pipeline/*` ela leva 403 sempre (`lib/pipeline/auth.ts:96-99`). Em `/api/mcp` também, porque a permissão dela não inclui `read` (`app/api/mcp/route.ts:33`). O 2º servidor, o da tool `observatorio_leitura` (`registrarServidorDoObservatorio`), **não está montado em rota nenhuma**, e o `responder` da "Tarefa 10" não existe no código.
- **Fato novo (Yannis I4, Hanna 1; conferido por comparação, sem imprimir o valor):** o servidor MCP `bythiagofigueiredo` do Claude Code (`~/.claude.json`, `type: http`, `https://bythiagofigueiredo.com/api/mcp`) manda no `X-Pipeline-Key` um valor **igual** a `PIPELINE_COWORK_KEY`. Essa chave tem `read`. Portanto, assim que a B2 subir, `youtube_observatory`/`get_observed` responde também no Claude Code, **pela chave permanente**, o que o §7 ("a chave permanente nunca é usada no Claude Code") e a decisão do dono de 13/10 proíbem. O desvio **já existe para todas as outras ferramentas**; o lote não o cria nem o agrava (é leitura, sem dado sensível, tudo público).
- "B só para o Cowork" não é uma opção real. As opções reais estão no B0.

### ◆ Dono decide antes do B (cada pergunta com padrão, para o trabalho não parar; Hanna P1–P3)

- **P1. A chave permanente está instalada no seu Claude Code (`~/.claude.json`), contra a decisão de 13/10.** (i) deixar até a chave pessoal ler, como dívida com gatilho; (ii) tirar agora, o que corta também as tools atuais do MCP nele, por prazo sem estimativa. **Padrão: (i)**, com a frente da chave pessoal na fila. Nenhum agente revoga nada nos dois casos.
- **P2. B agora (a') ou B espera inteiro (b)?** **Padrão: (a')**: custo ~80K tokens, risco de dado zero (só leitura, segue a flag). (b) custa o mesmo mais tarde, um build a mais, e a pergunta do dono ("quem está testando título agora?") fica sem resposta por prazo sem estimativa.
- **P3. A frente "chave pessoal lendo"** (montar o servidor do perfil, o `responder` da Tarefa 10, permissão `read` na rota) **entra quando?** **Padrão:** logo depois da flag ligada, como próxima frente pequena; pedir estimativa ao planejador (hoje **sem estimativa**).

Sem resposta do dono, vale o padrão, registrado no ledger com a data.

---

## Mapa de arquivos

`O/` = `apps/web/src/lib/youtube/teste-youtube/observados/`, `TO/` = `apps/web/test/youtube/teste-youtube/observados/`.

| Arquivo | Envio | Papel |
|---|---|---|
| `O/inferir.ts` (acrescido na T2, reescrito na T3) | A | regra v2 pura, tipos `Observado` por campo, `ficou` tipado, `gravacao()` (T6), `tituloValido` |
| `O/guarda.ts` (novo, puro) | A | placeholder: decisão por achados, `titulosSuspensos`, laço de até 3 iterações |
| `O/alarme.ts` (novo, puro) | A | dia BRT anterior, condições 1–3 do §6.1, um texto por condição |
| `O/estado-de-leitura.ts` (reescrito) | A | `EstadoTitulo`/`EstadoMiniatura`, ordem 1–9 do §5, `lerLinha`/`lerCursor` |
| `O/textos.ts` (novo, puro) | A | textos do §11 |
| `O/ensaio.ts` (novo, puro) | A | carregador do export/fixture + `ensaiar` (replay da CI e ensaio a seco) |
| `O/paginar.ts` (novo, servidor) | A | `paginado` e `ida` extraídos de `passo.ts` (T9) |
| `O/avisos.ts` (novo, servidor) | A | I/O do alarme e do aviso da guarda |
| `O/passo.ts` | A | `select`, `agora` único, guarda com I/O, contadores, `=== 0`, D-P3 via `gravacao` |
| `apps/web/src/lib/youtube/agenda/tarefas/avisos-pendentes.ts` | A | parte nova `leitura` em `DepsAvisos` |
| `apps/web/scripts/obs-dry-run.ts` + `obs-dry-run.sql` (novos) | A | ensaio a seco (§8.0) |
| `TO/fixtures/replay-23-10.json`, `TO/fixtures/amostra-cli.json` (novos) | A | recorte de 35 alvos; amostra real da CLI |
| `apps/web/src/lib/pipeline/services/leitura-concorrentes.ts` (novo) | B | função única da rota e do MCP |
| `apps/web/src/app/api/pipeline/youtube/competitors/observed/route.ts` (novo) | B | `GET` |
| `api-registry.ts`, `leitura-rotas.ts`, `data/pipeline-docs/cowork-docs-youtube.md`, `test/mcp/youtube-cowork-docs-observatorio.test.ts`, `test/mcp/mcp-registry-sync.test.ts` | B1 | Pipeline Integrity (rota + registro + doc + contagens) |
| `mcp/tools.ts`, `mcp/services/youtube-observatory.ts` | B2 | ação MCP |

## Ordem e custo

| # | Tarefa | Depende de | Tokens (executor Sonnet) |
|---|---|---|---|
| T1 | Fixture + carregador | prep, amostra | ~35K |
| T2 | Regra v2 do título + replay dos 35 | T1 | ~70K |
| T3 | Miniatura v2 + montagem (`Observado`, `trocas`, `ficou`) + replay da miniatura | T2 | ~60K |
| T4 | Simulação com semente + contrato `classificarTitulo` | T2 | ~35K |
| T5 | Guarda pura | T3 | ~35K |
| T6 | `gravacao()` + `passo.ts` | T3, T5 | ~65K |
| T7 | `estadoDeLeitura` por campo + `lerLinha`/`lerCursor` | T3, T6 | ~50K |
| T8 | Textos do §11 | T7 | ~25K |
| T9 | `paginar.ts`, alarme e aviso da guarda | T5, T6 | ~65K |
| T10 | Ensaio a seco | T6, T7, T8, T9 | ~45K |
| T11 | Fecho do envio A | todas | ~15K |
| B0 | Portão: decisão sobre a chave por pessoa | — | — |
| B1 | Serviço + rota + registro + doc + contagens | T8, B0 | ~55K |
| B2 | Ação MCP | B1 | ~25K |

Total: A ≈ 500K, B ≈ 80K. Só T4 corre em paralelo (com T5/T6; arquivos disjuntos). As demais vão em sequência.

**Calendário (Hanna 3).** A é promovido em 25/10 se o código e a revisão final de Phil e Yannis fecharem até 24/10 à noite; senão, na seguinte, sem pressa (a poda é ≈ 17–18/11). **B entra no build que liga a flag (≥ 26/10)**, ou antes, se sobrar slot: com a flag off a única resposta de B é "desligada", então B não está no caminho crítico de 25/10. B1 e B2 não disputam o executor com o caminho crítico de A.

## Dívida declarada e conferência de merge (r2.1)

- **Frescor para alvo que saiu (Yannis R7).** A v2 não isenta o alvo saído do frescor de 9 h (a v1 isentava). Se a última avaliação dele roda > 9 h depois da última rodada (disparo sem tempo, fila atrasada), vira `nao_medido` e nenhuma linha é gravada. Hoje a janela é de 6 h + ≤ 20 min, raro. **Aceito como dívida, não se limita `agoraMs`** (a variante `agoraMs = min(c.agora(), Date.parse(a.ultimaRodadaEm) + 1 h)` fica registrada). Gatilho: `obs_sem_tempo > 0` por 3 dias seguidos.
- **Antes do merge (Yannis, §6.4):** `git grep -n "estado-de-leitura\|observados/inferir" origin/staging -- apps/web/src apps/web/scripts` para ver se a F2/F3 passou a importar `estadosDeLeitura`/`lerEstadosDeLeitura` (a T7 os remove); se sim, adaptar antes do merge.

## Contas corrigidas (Phil M7, §4)

- **Guarda (§6.2).** Os lotes de ids incluem os alvos que saíram (certo), então são **~4 lotes hoje**, e não 2: 17 alvos com linha × ~3 versões × 1 bruto × 4 avaliações por dia × 4 lotes ≈ **816 consultas por dia**; com 3× canais, ≈ 6.700 por dia. A ~10 ms cada (estimativa, não medida), são ~8 s por dia hoje e ~70 s com 3×, espalhados por ~72 disparos. Cabe. Se pesar: uma consulta por lote com `.in('titulo_exibido', todos os brutos)`.
- **Alarme.** ~4.000 leituras estreitas por execução, uma vez por dia: 4 a 6 consultas, 2 páginas por lote de 100 ids.
- **Export do ensaio (Phil P2).** ≈ 62 mil linhas (~2.000 por dia × 31 dias). Medido no CSV de evidência (9.796 linhas): ~600 B por linha em objeto (**~37 MB**) e ~360 B em vetor colunar (**~22 MB**). O SQL devolve o formato colunar, em **4 arquivos semanais de ~5 MB**; a T10 manda conferir `wc -c` e o fim de cada um. Estimativa até haver o `wc -c` real.
- **Poda.** A 1ª poda é em `min(greatest(saiu_em + 30 d, reter_ate))`, ≈ 17–18/11. Ela só alcança alvo que saiu; o histórico de quem está ativo não é podado. **Com a flag off até lá, o bruto desses alvos nunca terá estado inferido: perda aceita, e escrita aqui.**

## Foco de revisão (o spec implica, nenhum teste de tarefa cobriria sozinho)

1. **Limite exato do frescor.** Na regra, a última rodada de W vale se `agoraMs − tUltima < 9 h`. Na leitura, o alvo cai para `sem_leitura` se `agoraMs − ultimaRodadaEm > frescorMs`. Os dois lados da borda (8 h 59 e 9 h 01) têm teste (T2, T7).
2. **Mesma versão com textos brutos diferentes** (NFC × NFD, espaço invisível). A versão é a chave normalizada, mas a guarda consulta **cada** texto bruto dela. Um placeholder que aparece com dois brutos é pego pelos dois (T5, T6).
3. **Virada do dia em São Paulo.** O dia D do alarme vai de 03:00Z a 03:00Z. Uma leitura às 02:59Z do dia seguinte é de D, e uma às 03:00Z não é (T9).
4. **Histórico longo.** Um alvo com 120 rodadas e 8 versões (fim da janela de 30 d) avalia em < 50 ms (O(R²·v), §3.3), para não estourar o disparo (T2).
5. **Placeholder só no passado.** Uma versão suspensa que existiu apenas na última janela de teste, fora de W, nunca aparece em `trocas` nem em `ficou` (T6, semente D+3).
6. **Falha da consulta nunca vira "sem achado".** Erro da guarda lança; erro de página do alarme lança; nada avalia com dado parcial (T6, T9).

---

### T1: Fixture do replay e carregador

**Arquivos**
- Criar: `TO/fixtures/replay-23-10.json`, `O/ensaio.ts` (só o carregador nesta tarefa), `TO/ensaio-carregador.test.ts`.
- Modificar: `O/inferir.ts` (só o campo novo de `LeituraObs`), `O/passo.ts` (2 linhas), `TO/fabrica.ts`, `TO/pureza.test.ts` (lista passa a incluir `ensaio.ts`).

**Interfaces**
- Produz:
  ```ts
  export interface LinhaExport { yt: string; rodada_id: string; lida_em: string; http: number | null; erro: string | null; jogador_bloqueado: boolean; idioma: string | null; titulo_exibido: string | null; thumb_http: number | null; dhash: string | null; variante: string | null; largura: number | null; altura: number | null; publicado_em: string | null; canal?: string | null; saiu_em?: string | null; saiu_por?: string | null; alvo_rodadas?: number | null; ultima_rodada_em?: string | null }
  export interface FixtureColunar { fonte: string; agora: string; colunas: (keyof LinhaExport)[]; linhas: unknown[][] }
  export interface AlvoExport { ytId: string; canal: string | null; publicadoEm: Date | null; saiuEm: string | null; saiuPor: string | null; leituras: LeituraObs[]; thumbsPorId: Map<number, ThumbObs>; rodadas: number; ultimaRodadaEm: string | null }
  export function linhasDaFixture(f: FixtureColunar): LinhaExport[]
  export function extrairLinhas(texto: string): LinhaExport[]   // JSON de array de linhas, [{ json_agg: [...] }], o formato colunar { colunas, linhas } e o envelope da CLI (amostra-cli.json)
  export function isoDoBanco(s: string): string                 // '2026-10-19 01:20:55.353+00' -> '2026-10-19T01:20:55.353Z'
  export function carregarExport(linhas: readonly LinhaExport[]): Map<string, AlvoExport>
  ```
  `carregarExport` cria um `ThumbObs` sintético por linha com `thumb_http` não nulo (`id` = índice da linha) e liga `miniaturaId` a ele. Quando as colunas `saiu_em`/`saiu_por`/`alvo_rodadas`/`ultima_rodada_em` existem, o alvo usa as do export; senão `rodadas` = nº de `rodada_id` distintos e `ultimaRodadaEm` = maior `lida_em`. `LeituraObs` já sai no formato final: `tituloExibido` preenchido; `tituloOficial`/`tituloFonte` com o valor neutro que o tipo aceitar (campos legados, saem na T3).

- [ ] **Passo 1: gerar a fixture.** Os 35 ids são os 25 de `$EV/rotulos-23-10.md` mais os 10 de título único sorteados no `replay-resultado-mistas-hist-23-10.md`: `YXfydW4tLAU G-Hyv6lQG0c g0W5cPmkWKM 3kH2Mq6kE6E 5LrOAfgIdw4 teMVb72ZMB8 A-lHdxsfYCE dgFKO2dyYhc z9uCiPIfKb0 3vyzSTWAxno`. Use `python3 -I` com o módulo `csv` (os títulos têm vírgula). A saída é colunar, nas colunas de `LinhaExport` sem `canal` e sem as quatro opcionais. Converter: `'NULL'` e `''` viram `null`; `http`, `thumb_http`, `largura` e `altura` viram int; `jogador_bloqueado` vira bool; `lida_em` e `publicado_em` passam por `isoDoBanco`. A linha do CSV sem `lida_em` é descartada (como faz o protótipo). `rodada_id` vira `r<n>`, na ordem da 1ª aparição. `fonte` = `"replay-23-10.csv, 35 alvos (25 rotulados + 10 de título único), 1841 leituras"`. **`agora` = `"2026-10-23T17:41:00.698Z"`**, o `END` do protótipo (maior `lida_em` do CSV inteiro; o replay usa esse valor, não o máximo do recorte). JSON compacto, sem indentação. Conferir: 1841 linhas, 35 ids distintos, maior `lida_em` do recorte = `2026-10-23T17:40:58.820Z`, arquivo < 400 KB (medido: ~352 KB).
- [ ] **Passo 2: teste que falha** (`ensaio-carregador.test.ts`):
  - `isoDoBanco` (Phil M1): `'2026-10-19 01:20:55.353+00'` → `'2026-10-19T01:20:55.353Z'`; `'…58.82+00'` → `'…58.820Z'`; sem fração (`'…55+00'`) → `'…55.000Z'`; 6 dígitos (`'…55.353123+00'`) → `'…55.353Z'`. Implementar como `new Date(s.replace(' ', 'T').replace(/\+00$/, 'Z')).toISOString()`, nunca por troca de texto;
  - a fixture carregada tem 35 alvos e 1841 leituras, e a `agora` dela é `2026-10-23T17:41:00.698Z`;
  - `2emVR-6NEmM` tem `publicadoEm` não nulo e `rodadas` igual ao número de `rodada_id` distintos;
  - toda leitura com `thumb_http` tem `thumbsPorId.get(miniaturaId)`;
  - `extrairLinhas` aceita `[{"json_agg":[{...}]}]`, `[{...}]` e o colunar, e devolve o mesmo resultado; **aceita o envelope real de `fixtures/amostra-cli.json`** (3 linhas); texto que não é JSON lança `Error('export ilegível')`.
- [ ] **Passo 3: rodar e ver falhar.** `cd /Users/figueiredo/Workspace/bt-leitura/apps/web && npx vitest run test/youtube/teste-youtube/observados/ensaio-carregador.test.ts > /tmp/leitura-T1.log 2>&1; tail -20 /tmp/leitura-T1.log`. Esperado: FAIL (módulo ausente).
- [ ] **Passo 4: implementar** `ensaio.ts` (o carregador), o campo novo de `LeituraObs`, o `select`/mapeamento de `passo.ts` e o `fabrica.ts`, conforme a "Sequência de remoção" (T1). **Nada é removido e nenhum teste é pulado.**
- [ ] **Passo 5: rodar e ver passar** (mesmo comando, mais a pasta inteira `observados`, que continua verde). `cd apps/web && npx tsc --noEmit > /tmp/leitura-T1-tsc.log 2>&1; tail -5 /tmp/leitura-T1-tsc.log` vazio.
- [ ] **Passo 6: commit.** `git add apps/web/src/lib/youtube/teste-youtube/observados/{ensaio.ts,inferir.ts,passo.ts} apps/web/test/youtube/teste-youtube/observados/{fixtures/replay-23-10.json,fixtures/amostra-cli.json,ensaio-carregador.test.ts,fabrica.ts,pureza.test.ts}` e depois `git commit -m "test: fixture do replay de 23/10 (35 alvos) e carregador do export"` (o hook passa).

**Pronto quando** a fixture está no repo com < 400 KB, o carregador está verde e o `tsc` está vazio.

---

### T2: Regra v2 do título (§3.1–§3.6) e replay dos 35

**Arquivos**
- Modificar: `O/inferir.ts` (**só acrescenta** as funções novas; a v1 fica intacta até a T3).
- Testes: `TO/regra-v2.test.ts` (novo), `TO/replay.test.ts` (novo).

**Interfaces**
- Consome: `LeituraObs`, `carregarExport` (T1).
- Produz:
  ```ts
  export interface Rodada { tMs: number; rodadaId: string; versoes: ReadonlySet<string> }   // tMs = menor lida_em válida da rodada
  export type EstadoRegra = 'em_andamento' | 'sumindo' | 'terminou' | 'troca' | 'indeterminada' | 'sem_troca_vista' | 'nao_medido'
  export interface Decisao { estado: EstadoRegra; w: Rodada[]; x: string | null; s: string[]; sumidas: string[]; janelaTeste: Rodada[] | null; antes: string | null; mistasHist: number }
  export function tituloValido(l: LeituraObs): boolean                                   // validade do §3.1; também usada pela guarda e pelo alarme
  export function rodadasDoTitulo(ls: readonly LeituraObs[], suspensos?: ReadonlySet<string>): { rodadas: Rodada[]; brutos: Map<string, Set<string>> }
  export function qualificadas(janela: readonly Rodada[]): Set<string>                 // vista em >= 2 rodadas da janela
  export function rodadasMistas(hist: readonly Rodada[], q: ReadonlySet<string>): number
  export function rodadasExigidas(q: number): number                                   // ceil(ln ALFA / ln(1 - min(q, Q_TRAVA))); q <= 0 -> 0 explícito
  export function decidirCampo(campo: CampoObs, rodadas: readonly Rodada[], o: { publicadoMs: number; agoraMs: number }): Decisao
  ```
  Mapa para o protótipo: `EA`→`em_andamento`, `EA_SUMINDO`→`sumindo`, `TERM`→`terminou`, `TROCA`→`troca`, `SEM`→`sem_troca_vista`, `NM`→`nao_medido`, `INDET`→`indeterminada`.

**Algoritmo** (porte fiel de `avalia`, `decide_unica`, `ultima_janela_teste`, `periodo` e `ausencia_ok` do protótipo, com as diferenças do spec):
- Validade do título: §3.1 (`tituloValido`). Só vota o idioma majoritário (`maioria`, empate para o mais recente), **calculada depois de tirar os suspensos**; idioma nulo nunca vota. Chaves em `suspensos` contam como leitura inválida.
- `W = rs.slice(-8)`, `W₋₁ = rs.slice(-9, -1)`, `W⁻ = rs.slice(-16, -8)` filtrada por `tMs >= publicadoMs + 24 h`.
- W precisa do mínimo de rodadas, de um span ≤ 72 h e de `agoraMs − W.at(-1).tMs < 9 h`; senão, `nao_medido`.
- É teste se `qualificadas(W).size >= 2` e `rodadasMistas(rs, q) >= 2`. Senão, `qualificadas(W).size !== 1` → `nao_medido`. Com X único: se `W₋₁.length < min` ou `qualificadas(W₋₁)` ≠ {X}, `nao_medido`.
- A última janela de teste percorre `e` de `rs.length` até 8, com `w = rs[e-8:e]` e histórico `rs[:e]`. O título com S ≠ {X} usa q sobre `periodo(rs, Y)` (16 rodadas no mínimo) e R = rodadas desde a última com Y. Todas cumprem → `terminou`; senão, `sumindo`.
- **Sem janela de teste (ou na miniatura), vale W⁻ depois da carência, literal de `decide_unica` (Phil I1):** `len(W⁻) < min` → `nao_medido`; `qual(W⁻) = {X}` → `sem_troca_vista`; `len(qual(W⁻)) == 1` e R cumprido (q sobre W⁻) → `troca`, com `antes = Y`; senão, **na miniatura com `len(qual(W⁻)) >= 1`** (inclusive `qual = {X, Y}`) → `indeterminada`; senão `nao_medido`.
- No título, teste vira `em_andamento`; na miniatura, `indeterminada` (§3.4).

- [ ] **Passo 1: testes que falham** em `regra-v2.test.ts`. Usar o fabricante `rodadas()` de `fabrica.ts`, que monta 3 passadas a cada 6 h, e um título por letra (`tituloExibido: 'Titulo ' + letra`):
  - `rodadasExigidas(1) === 2` (trava), `rodadasExigidas(0.5) === 11`, `rodadasExigidas(0.2) === 35`, **`rodadasExigidas(0) === 0`** (sem `-Infinity`/`NaN`; Phil M6);
  - **troca limpa A→B** (Phil M4), A nas rodadas 1–20 e B da 21ª em diante, avaliada a cada rodada da 21ª à 40ª: nenhum estado `em_andamento`; a **1ª `troca` sai na avaliação com 28 rodadas** (a 8ª de B); antes dela só `sem_troca_vista`/`nao_medido`. Sem margem de ± 1;
  - **Y em 100% de W⁻ e 1 blip de Y em W:** nunca `troca` enquanto R < 2;
  - **Y em todas as rodadas do período** (q = 1): `rodadasExigidas` dá 2, sem `-Infinity`/`NaN`;
  - **teste A/B seguido de troca manual para C:** 12 rodadas alternando A/B, depois 16 de C: `terminou`, com `x = 'Titulo C'` e `sumidas = ['Titulo A', 'Titulo B']`;
  - **2 idiomas (D-P4):** maioria `pt` com 2 títulos e minoria `en` com um 3º: o 3º não vota. No empate 9×9, vale o idioma da leitura mais recente. **Leitura de idioma nulo nunca vota** (nem desempata);
  - **suspenso antes da maioria:** um título suspenso tirado da conta muda a maioria do idioma, e o teste prova que a maioria foi calculada depois;
  - **frescor (foco 1):** última rodada a 8 h 59 min → medido; a 9 h 01 min → `nao_medido`;
  - **span:** 8 rodadas espalhadas em 73 h → `nao_medido`;
  - **miniatura com qualificada {X, Y} sem troca** (`decidirCampo('miniatura', …)`) → `indeterminada`, nunca `nao_medido` nem `troca` (Phil I1);
  - **custo (foco 4):** 120 rodadas, 8 versões alternando → `decidirCampo` em < 50 ms (`performance.now()`).
- [ ] **Passo 2: replay** em `replay.test.ts`. Carregar a fixture, `agoraMs` = `agora` da fixture (`2026-10-23T17:41:00.698Z`), `publicadoMs` de cada alvo. Esperado **exato** (saída do protótipo, `replay-resultado-mistas-hist-23-10.md` §2), **tabela do título**:

  | estado | alvos |
  |---|---|
  | `em_andamento` | 2emVR-6NEmM, FxP6Yzehs3k, KdCouw4w7uA, rh4LfKilm6s, NsYd2UAN2AA, ADECP7e1kjE, 0thg8eunUto, lnPfS9BCC_M, Y6pJEbktw7Y, pilQupJKe2o, TtjDltoXhqI, vzD6swtayKk, kY4nm1gdXwg, bY2q7zTwep4, DUj-F_Ff2Aw |
  | `sumindo` | AKKb2Oz77fw, xQcKF7hVts0, iqTrdmtqCCg |
  | `sem_troca_vista` | 6MYeq9cWCT8, 50b-VZ_PJZU, hm7FwmxfHp4, wr_NzNbKDVY + os 10 de título único |
  | `nao_medido` | Tk_0L_vS5Y4, 8fi8uOPOJA8, ZdJe2woz0jY |

  Também: nenhum dos 10 de título único dá `em_andamento`, `sumindo`, `terminou` ou `troca`. A **tabela da miniatura** (mesma `agora`) fica na T3, que é onde nasce `rodadasDaMiniatura`. Uma divergência **não se resolve mexendo em limiar**: pare e devolva ao controlador com o alvo, o esperado e o obtido.
- [ ] **Passo 3: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/regra-v2.test.ts test/youtube/teste-youtube/observados/replay.test.ts > /tmp/leitura-T2.log 2>&1; tail -30 /tmp/leitura-T2.log`.
- [ ] **Passo 4: implementar** as funções acima em `inferir.ts`, **sem remover nada da v1** (Yannis I1). `versoesDeMiniatura` e `maioria` ficam; `maioria` passa a receber as leituras já sem os suspensos.
- [ ] **Passo 5: rodar e ver passar** (mesmo comando, mais a pasta `observados` inteira: a v1 continua verde). Esperado: PASS, 0 divergências. `npx tsc --noEmit` vazio (`/tmp/leitura-T2-tsc.log`).
- [ ] **Passo 6: commit** com `feat: regra v2 do título dos concorrentes (rodadas, janelas, mistas no histórico) e replay de 23/10`.

**Pronto quando** o replay do título dá 35/35 e as sementes do §9.2 de regra estão verdes.

---

### T3: Miniatura v2, montagem do `Observado` e replay da miniatura (§3.7, §4)

> r2.1 (Phil M-e): o teste de surrogate (8 × 300 emojis) confere também o baixo solto: `/(?<![\ud800-\udbff])[\udc00-\udfff]/` não casa em nenhum campo cortado. O corte por ponto de código separa a bandeira em dois indicadores regionais: válido para o `jsonb`, só feio na tela; aceito.

**Arquivos**
- Modificar: `O/inferir.ts` (troca a v1 pela v2, conforme a "Sequência de remoção"), `O/passo.ts` (**só** o necessário para compilar).
- Testes: reescrever `TO/inferir.test.ts`, onde ficam os testes da v1 que ainda valem (validade da miniatura, placeholder 120×90, variante dominante, Hamming) e os novos; acrescentar a tabela da miniatura a `TO/replay.test.ts`.

**Interfaces**
- Consome: `decidirCampo`, `rodadasDoTitulo` (T2).
- Produz:
  ```ts
  export interface VersaoObs { v: number; ref: string; primeira_vista: string; ultima_vista: string; leituras: number; rodadas: number }
  export interface VersaoEmW { v: number; rodadas_em_w: number; ultima_vista: string }
  export interface Transicao { antes: string; de: string; ate: string }                                    // D-P1
  export interface FicouTitulo { titulo: string; versoes: VersaoEmW[]; sumindo: boolean; mistas_hist: boolean; janela_teste: { de: string; ate: string } | null; versoes_omitidas: number; transicao: Transicao | null }
  export interface FicouMiniatura { dhash: string; versoes: VersaoEmW[]; versoes_omitidas: number; transicao: Transicao | null }
  interface Base { versaoRegra: number; tipoTroca: TipoTroca; trocas: VersaoObs[]; nVersoes: number; ficouEstado: 'estavel' | 'em_andamento'; motivo: null; primeiraTrocaEm: string; ultimaAtualizacaoEm: string }
  export interface ObservadoTitulo extends Base { campo: 'titulo'; veredito: 'possivel_teste_youtube' | 'troca_observada'; ficou: FicouTitulo }
  export interface ObservadoMiniatura extends Base { campo: 'miniatura'; veredito: 'troca_observada'; ficou: FicouMiniatura }   // proibido por tipo (§3.7)
  export type Observado = ObservadoTitulo | ObservadoMiniatura
  export interface EntradaObs { leituras: readonly LeituraObs[]; thumbsPorId: ReadonlyMap<number, ThumbObs>; publicadoEm: Date; agoraMs: number; titulosSuspensos?: ReadonlySet<string> }
  export interface VersaoParaConferir { chave: string; brutos: string[]; primeiraVista: string; ultimaVista: string }
  export interface ResultadoObs { observados: Observado[]; indeterminadas: number; validasTitulo: number; validasMiniatura: number; estadoTitulo: EstadoRegra; estadoMiniatura: EstadoRegra; versoesTitulo: VersaoParaConferir[]; versoesDemais: boolean }
  export function rodadasDaMiniatura(ls: readonly LeituraObs[], thumbsPorId: ReadonlyMap<number, ThumbObs>): Rodada[]   // usa versoesDeMiniatura (Yannis M9)
  export function inferirObservadoDetalhe(e: EntradaObs): ResultadoObs
  export function montarObservado(campo: CampoObs, veredito: string, ...): Observado   // lança Error('miniatura nunca é possivel_teste_youtube') (§3.7)
  ```
  - Mapa estado → linha: a tabela do §4. `sem_troca_vista`, `nao_medido` e `indeterminada` com menos de 2 componentes qualificados → **nenhuma linha**.
  - "Versão do alvo" é a que tem 2 rodadas com ela a ≤ 7 rodadas de distância, ou seja, qualificada em alguma janela de 8. `trocas` segue a ordem da 1ª vista; acima de 8 versões, ficam as 8 com `ultima_vista` mais recente, `nVersoes` = total real, `versoes_omitidas = n − 8` e `versoesDemais = true`.
  - `ficou.titulo` é X em `terminou`/`troca`; em `em_andamento`/`sumindo`, é a versão com mais rodadas em W (empate: `ultima_vista` mais recente). `ref` e `titulo` cortam em 300 **pontos de código**. `janela_teste` vem de W em `em_andamento`/`sumindo`, da última janela de teste em `terminou`, e é `null` no resto. `transicao` só em `troca` (D-P1).
  - `primeiraTrocaEm` é a `primeira_vista` da 2ª versão em ordem de 1ª vista, no histórico inteiro.
  - `validasTitulo`/`validasMiniatura` = `w.length`, ou 0 quando o estado é `nao_medido` (§4, Cursor).
  - `versoesTitulo` traz **todas** as versões do alvo no título (não só as 8), com os textos brutos, para a guarda (§6.2, "Quais versões").
  - `indeterminadas` conta os pares consecutivos com Hamming entre 7 e 9, como hoje (§3.7, mudança pequena).

- [ ] **Passo 1: testes que falham** (`inferir.test.ts`, `replay.test.ts`):
  - **invariantes (§9.6):** a miniatura nunca sai `possivel_teste_youtube` (A/B de miniatura alternando dá `troca_observada` + `em_andamento` + `alternada`); o título nunca sai `troca_observada` + `em_andamento`; `montarObservado('miniatura', 'possivel_teste_youtube', …)` lança;
  - **< 4 KB no pior caso de bytes (Phil M3):** `Buffer.byteLength(JSON.stringify(ficou)) < 4096` com 8 versões de 300 **emojis** (4 bytes cada); e o corte de `ref` em 300 não deixa surrogate solto (`JSON.parse(JSON.stringify(x))` ida e volta e `/[\ud800-\udbff](?![\udc00-\udfff])/` sem casar);
  - 9 versões gravam 8 em `trocas`, com `nVersoes === 9`, `ficou.versoes_omitidas === 1`, `versoesDemais === true` e estado decidido por W;
  - `primeiraTrocaEm` igual em duas chamadas seguidas com `agoraMs` diferente;
  - **Hamming 8** (`DH_A`→`DH_C` estável por 16 rodadas): 0 observados, `indeterminadas > 0`, `validasMiniatura > 0`;
  - troca de miniatura `DH_A`→`DH_B` limpa: 1 linha `troca_observada`/`estavel`/`sequencial`, com `ficou.transicao.antes === DH_A` e `ate` preenchido;
  - teste de título → linha `possivel_teste_youtube`/`em_andamento`/`alternada`, `ficou.mistas_hist === true`, `ficou.versoes[*].rodadas_em_w` somando as rodadas de W;
  - **replay da miniatura (Phil I1), com `agora` da fixture e igualdade exata:** `indeterminada` = {0thg8eunUto, bY2q7zTwep4}; `nao_medido` = {8fi8uOPOJA8, DUj-F_Ff2Aw, kY4nm1gdXwg, ZdJe2woz0jY}; `sem_troca_vista` = os outros 29. Se o filtro de variante dominante do código atual mudar algum dos 35 em relação ao protótipo (que não filtra), isso é **divergência a reportar**, não limiar a mexer.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/inferir.test.ts test/youtube/teste-youtube/observados/replay.test.ts > /tmp/leitura-T3.log 2>&1; tail -30 /tmp/leitura-T3.log`.
- [ ] **Passo 3: implementar** a montagem e `OBS_REGRA_VERSAO = 2`; remover a v1 e os campos legados e ajustar `passo.ts` no mesmo commit (Sequência de remoção, T3). `inferirObservado(e)` continua como atalho de `inferirObservadoDetalhe(e).observados`.
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando, mais `regra-v2.test.ts`; depois a pasta inteira (os `it.skip` previstos de `passo.test.ts`, se houver, ficam anotados). `npx tsc --noEmit` vazio (`/tmp/leitura-T3-tsc.log`).
- [ ] **Passo 5: commit** com `feat: gravação da regra v2 (ficou por campo, teto de 8 versões, invariantes da miniatura)` (o hook passa).

**Pronto quando** os invariantes do §9.6 passam, a miniatura bate 29/4/2 e nenhuma linha emitida tem `nVersoes < 2`.

---

### T4: Simulação com semente e contrato com `classificarTitulo` (§9.3, §9.4)

**Arquivos**
- Testes novos: `TO/simulacao.test.ts`, `TO/contrato-classificar.test.ts`.

**Interfaces**
- Consome: `decidirCampo`, `Rodada` (T2); `carregarExport` (T1); `classificarTitulo` (`teste-youtube/titulo.ts`), `resolverOpcoes` (`tipos.ts`), `prepararLeituras` (`preparar.ts`), todos sem mudança.

- [ ] **Passo 1: `simulacao.test.ts` (Phil I6).** `mulberry32(seed)` local ao teste, **semente fixa 2023**. Para pesos 80/20 e 90/10: **5.000 alvos** (a regra é O(R·v) e 40 rodadas custam microssegundos), 40 rodadas de 3 leituras sorteadas, avaliação **só na 40ª**. Afirmar que a contagem de `terminou`/`troca` é **< 50** (fração < 0,01) nos dois pesos (média esperada ~30 no 90/10; P(falso vermelho) < 0,1%), e que o teste inteiro roda em < 5 s (`performance.now()`). Não comparar com os números do Python (§9.3). **Se falhar, não se troca a semente nem o limite:** volta ao controlador com o número.
- [ ] **Passo 2: `contrato-classificar.test.ts`.** `LIMIARES_CONCORRENTE = resolverOpcoes({ minLeituras: 18, minVotosPorVariante: 2, minRodadasMistas: 2, minJanelaMistaMs: 0, minFracaoRodadasMistas: 0.1, maxVariantes: 8, quarentenaEscritaMs: 0 })`, com o comentário do motivo de cada valor (§9.4). O adaptador fica só no teste, como no §9.4. Para cada alvo da fixture que a v2 dá `em_andamento`: `estado === 'provavel_teste'` e as versões qualificadas de W na v2 ⊆ `variantes`, comparando os textos normalizados. São 15 alvos, e o esperado é 15/15. Uma divergência volta ao spec; não se mexe em limiar.
- [ ] **Passo 3: rodar.** `npx vitest run test/youtube/teste-youtube/observados/simulacao.test.ts test/youtube/teste-youtube/observados/contrato-classificar.test.ts > /tmp/leitura-T4.log 2>&1; tail -30 /tmp/leitura-T4.log`. O código já existe, então o esperado é PASS. Se falhar, é divergência real: pare e reporte.
- [ ] **Passo 4: commit** com `test: simulação com semente e contrato da regra v2 com classificarTitulo`.

**Pronto quando** os dois passam e `git diff --stat` não toca `titulo.ts`, `tipos.ts` nem `preparar.ts`.

---

### T5: Guarda pura (§6.2)

**Arquivos**
- Criar: `O/guarda.ts`, `TO/guarda.test.ts`.
- Modificar: `TO/pureza.test.ts`, para incluir `guarda.ts`.

**Interfaces**
- Consome: `inferirObservadoDetalhe`, `EntradaObs`, `VersaoParaConferir`, `ResultadoObs` (T3); `tituloValido` (T2).
- Produz:
  ```ts
  export interface Achado { ytId: string }
  export function ehPlaceholder(achados: readonly Achado[], o: { canalDoAlvo: string | null; canalDe: (ytId: string) => string | null; bateuTeto: boolean }): boolean
     // dedup no cliente; true se bateuTeto, ou >= 2 vídeos distintos, ou >= 1 vídeo de canal diferente do alvo (D-P8 para canal nulo)
  export type ConferirVersoes = (vs: readonly VersaoParaConferir[]) => Promise<ReadonlySet<string>>   // devolve as chaves suspensas; erro LANÇA
  export interface ResultadoGuardado { r: ResultadoObs; suspensos: ReadonlySet<string>; estourou: boolean; iteracoes: number }
  export async function inferirComGuarda(e: EntradaObs, conferir: ConferirVersoes, teto = TETO_ITERACOES_GUARDA): Promise<ResultadoGuardado>
  export function titulosSuspensos(leituras: readonly { ytId: string; canal: string | null; leitura: LeituraObs }[]): string[]   // só leituras com tituloValido; normalizado em >= 3 vídeos, ou >= 2 vídeos de canais distintos (canal nulo conta como canal distinto de qualquer outro e de outro nulo; Phil M-b); Map<titulo, Set<yt>>, sem filter dentro de map
  ```
  - `inferirComGuarda` só confere quando há linha de título a emitir. Cada versão é conferida uma vez só (`Set` das já conferidas). Uma versão suspensa entra em `titulosSuspensos` e a regra roda de novo. Se, no teto, ainda houver versão nova não conferida, sai com `estourou = true`, sem observado de título e com `validasTitulo = 0`. Um `conferir` que lança propaga o erro (a T6 trata).
  - **Canal nulo (D-P8):** teste adicional: achado de canal com remoção pedida (nulo de um lado só) → suspende (Yannis, D-P8). Nulo dos dois lados → não vale a regra de "outro canal"; nulo de um lado só → canal diferente.

- [ ] **Passo 1: testes que falham:**
  - `ehPlaceholder`: 1 outro vídeo do mesmo canal → false (**caso `Lolzin`**); 2 outros vídeos do mesmo canal → true; 1 vídeo de outro canal → true; 1500 achados do mesmo vídeo + 1 de outro, com `bateuTeto` → true; 1500 achados do mesmo vídeo sem teto → false; **canal nulo** (Phil M2/Yannis M3): 1 achado com `canalDe → null` e `canalDoAlvo = null` → false, 2 achados → true; 1 achado com canal nulo de um lado só → true;
  - `inferirComGuarda`: um placeholder P alternando com o título real em 5 rodadas faz a 1ª saída ser `em_andamento` com P. P é suspenso, a 2ª iteração dá `sem_troca_vista` e não há observado de título;
  - re-execução que cita versão nova não conferida chama `conferir` de novo, só com a nova;
  - um `conferir` que suspende sempre a versão nova mais recente estoura em 3 iterações: `estourou`, 0 observados de título, `validasTitulo === 0`;
  - **foco 2:** a versão com brutos `'Título'` (NFC) e `'Título'` (NFD) chega a `conferir` com os dois brutos;
  - `titulosSuspensos`: o mesmo título em 3 vídeos de 1 canal → suspenso; em 2 vídeos de 2 canais → suspenso; em 2 vídeos de 1 canal → não; **leitura inválida (`redirecionado`, `verificacao_robo`, `jogador_bloqueado` falso, conforme `tituloValido`) com título fixo em 3 vídeos → não conta** (Phil M2).
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/guarda.test.ts > /tmp/leitura-T5.log 2>&1; tail -30 /tmp/leitura-T5.log`.
- [ ] **Passo 3: implementar** `guarda.ts`.
- [ ] **Passo 4: rodar e ver passar** (mesmo comando, mais `pureza.test.ts`). `npx tsc --noEmit` vazio.
- [ ] **Passo 5: commit** com `feat: guarda de título repetido (placeholder) da leitura dos concorrentes`.

---

### T6: `gravacao()` e `passo.ts` (§4 reavaliação e cursor, §6.2 com I/O)

**Arquivos**
- Modificar: `O/inferir.ts` (acrescenta `gravacao`), `O/passo.ts`, `TO/passo.test.ts`, `TO/inferir.test.ts`.

**Interfaces**
- Consome: `inferirComGuarda`, `ehPlaceholder` (T5); `Observado` (T3).
- Produz `gravacao()` e os tipos `LinhaGravada`/`CursorGravado` (D-P7). Regras de `gravacao`:
  - uma `LinhaGravada` por `Observado`, com os nomes de coluna que `passo.ts` grava hoje (não renomear nada);
  - com `saiuPor !== null` (D-P3): `ficou_estado` forçado a `sem_desfecho` e `motivo = saiuPor` nas linhas `em_andamento` (título ou miniatura indeterminada); linha `estavel` fica como está;
  - cursor sempre; `validas_titulo`/`validas_miniatura` = os do `ResultadoObs`, ou 0 quando `estourou`; `avaliado_em = agoraIso`, `ultima_atualizacao_em` das linhas = o mesmo `agoraIso`.
- Muda em `passo.ts`:
  - `select` das leituras: `'id,rodada_id,lida_em,http,erro,jogador_bloqueado,idioma,titulo_exibido,miniatura_id'`;
  - `publicacoes()` devolve `{ publicado: Map<string, string | null>; canalDe: Map<string, string> }`, com a chave `chaveAlvo(site, yt)` e o valor `competitor_channel_id`;
  - `avaliar()` captura `const agoraMs = c.agora()` **uma vez** no topo e o usa em `inferir`, `gravacao` (via `agoraIso`) e `avaliado_em`;
  - a função `conferir` real, por versão e por texto bruto (Phil I2): `yt_watch_readings.select('youtube_video_id').eq('site_id', a.siteId).in('youtube_video_id', <lote de 100 ids de alvos concorrentes do site>).neq('youtube_video_id', alvo).eq('titulo_exibido', bruto).gte('lida_em', primeira − 24 h).lte('lida_em', ultima + 24 h).limit(1000).abortSignal(AbortSignal.timeout(BANCO_MS))`, e o teto é `data.length === 1000`. **`conferir` une os achados de todos os lotes de 100 ids antes de chamar `ehPlaceholder`; `bateuTeto` vale se algum lote devolveu 1.000; erro em qualquer lote lança** (Phil M-b). Teste: achados do mesmo bruto em 2 lotes diferentes somam para a regra de ≥ 2 vídeos; **`if (r.error || !Array.isArray(r.data)) throw new Error('guarda')`**: o alvo cai em `obs_falhou`, sem linha nem cursor, e volta à fila; nunca "nenhum achado". Os lotes de ids saem dos alvos de `tipo = 'concorrente'` do mesmo site, inclusive os que saíram; cada ida passa por `ida(c, fim)`;
  - contadores novos: `obs_titulo_suspenso` (versões suspensas mais estouros) e `obs_versoes_demais`;
  - `obs_sem_leitura_valida++` quando `validasTitulo === 0 || validasMiniatura === 0`; `< VALIDAS_MIN_MEDIDO` vira `=== 0` (Sequência de remoção);
  - D-P3 via `gravacao` (`saiuPor`), nunca "sem upsert".

- [ ] **Passo 1: testes que falham** (`passo.test.ts`, adaptando `mundo()` para leituras com `titulo_exibido` e `jogador_bloqueado: true`; reescreve os `it.skip` previstos na T3):
  - **relógio que avança** (`contexto(sb, T0, 1000)`): a linha tem `ultima_atualizacao_em === avaliado_em` do cursor;
  - **o upsert gravado é `toEqual` ao `gravacao(...)` mais `site_id`/`youtube_video_id`** (D-P7), para o caso de teste, o de troca e o de estouro da guarda; em `inferir.test.ts`, `gravacao` sozinha: estouro zera as `validas`, `saiuPor` força `sem_desfecho` só nas `em_andamento`; `lerCursor(cursorSemPublicacao(...))` → `motivo === 'sem_publicacao'`;
  - **(Yannis R1) as chaves do upsert do cursor são exatamente as colunas de `ab_native_obs_cursor`** (lista literal no teste, copiada da migration, mais `site_id`/`youtube_video_id`); `lerCursor({ avaliado_motivo: 'ok', … })` devolve `motivo: 'ok'` e `lerCursor({ motivo: 'ok', … })` devolve `null`;
  - **(Yannis R2)** alvo com `saiu_em` setado e `saiu_por` nulo, teste em W → `ficou_estado = 'sem_desfecho'`, `motivo = 'saiu'`;
  - **(R7, dívida declarada)** o frescor de 9 h (T2) vale também para alvo que saiu; não se limita `agoraMs` (ver "Dívida declarada"). Nenhum teste de `agoraMs` limitado;
  - teste de título → 1 linha `possivel_teste_youtube`, cursor com `validas_titulo > 0`;
  - **placeholder P em 5 vídeos, em 2 rodadas na virada do dia:** avaliado em D+1 e em D+3 (relógio relativo à fixture do mundo), dá 0 linhas com P em `trocas` nas duas vezes e `obs_titulo_suspenso > 0`. É o foco 5;
  - **`Lolzin`** (2 vídeos do mesmo canal com o mesmo título, cada um alternando com o próprio título) → as linhas saem, sem suspensão;
  - **1000+ leituras do placeholder num vídeo e 1 num 2º** → suspende;
  - **banco falso devolve `error` na consulta da guarda → 0 upserts em `ab_native_observados`, 0 cursores, `obs_falhou === 1`** (Phil I2, Yannis M4); idem com `data: null` sem `error`;
  - a consulta da guarda leva `site_id` (o banco falso confere o filtro);
  - **Hamming 8:** 0 linhas, cursor gravado, `obs_falhou === 0`;
  - **alvo com `saiu_em`/`saiu_por='janela'` e teste em W, sem linha anterior (D-P3, Yannis M1):** 1 upsert com `ficou_estado = 'sem_desfecho'`, `motivo = 'janela'`, cursor gravado; a linha nunca é gravada `em_andamento`;
  - `sem_troca_vista` depois de uma troca já gravada → a linha anterior fica intocada (mesmo `ultima_atualizacao_em`) e o cursor anda;
  - flag off → nada lido (já existe; manter).
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/passo.test.ts test/youtube/teste-youtube/observados/inferir.test.ts test/youtube/teste-youtube/observados/registrador.test.ts > /tmp/leitura-T6.log 2>&1; tail -30 /tmp/leitura-T6.log`.
- [ ] **Passo 3: implementar** `gravacao` e o `passo.ts`.
- [ ] **Passo 4: rodar e ver passar** (mesmo comando). Depois, a pasta inteira: `npx vitest run test/youtube/teste-youtube/observados > /tmp/leitura-T6b.log 2>&1; tail -8 /tmp/leitura-T6b.log`.
- [ ] **Passo 5: commit** com `feat: gravação única da regra v2 e passo do observador com guarda por versão e agora único` (o hook passa).

**Pronto quando** a pasta `observados` está verde e `cd apps/web && npx tsc --noEmit > /tmp/leitura-T6-tsc.log 2>&1` está **vazio** (alcançável: `VALIDAS_MIN_MEDIDO` segue exportado, `@deprecated`, só para `estado-de-leitura.ts`, até a T7).

---

### T7: `estadoDeLeitura` por campo (§5, §9.5) e leitura de volta

**Arquivos**
- Reescrever: `O/estado-de-leitura.ts`, `TO/estado-de-leitura.test.ts`.
- Criar: `TO/gravacao-leitura.test.ts` (ida e volta).

**Interfaces**
- Consome: `FicouTitulo`, `FicouMiniatura`, `VersaoObs`, `gravacao` (T3, T6); `modoTrocasConcorrente` (`flag.ts`), só no teste.
- Produz, com os tipos do §5 literais:
  ```ts
  export type Motivo = 'flag_off' | 'aprendendo' | 'sem_leitura' | 'sem_publicacao' | 'saiu' | 'regra'
  export interface VersaoLida { ref: string; rodadasEmW: number; ultimaVista: string }
  export type EstadoTitulo = …            // §5, as seis variantes
  export type EstadoTituloBase = Exclude<EstadoTitulo, { estado: 'nao_medido' } | { estado: 'fora_da_janela' }>
  export type EstadoMiniatura = …         // troca | indeterminada | sem_troca_vista | nao_medido | fora_da_janela
  export interface LinhaLida { veredito: 'troca_observada' | 'possivel_teste_youtube'; ficouEstado: 'estavel' | 'em_andamento' | 'sem_desfecho'; ficou: unknown; trocas: unknown; versaoRegra: number; motivo: string | null; ultimaAtualizacaoEm: string; tipoTroca: 'sequencial' | 'alternada' }
  export interface AlvoLido { rodadas: number; ultimaRodadaEm: string | null; saiuPor: string | null; publicadoEm: string | null }
  export interface CursorLido { avaliadoAteRodada: number; avaliadoEm: string; motivo: string; validasTitulo: number; validasMiniatura: number }
  export interface EntradaEstado { flagLigada: boolean; alvo: AlvoLido | null; cursor: CursorLido | null; linhas: { titulo: LinhaLida | null; miniatura: LinhaLida | null }; agoraMs: number; frescorMs: number }
  export function estadoTitulo(e: EntradaEstado): EstadoTitulo
  export function estadoMiniatura(e: EntradaEstado): EstadoMiniatura
  export function lerLinha(row: Record<string, unknown>): LinhaLida | null     // snake_case do banco -> LinhaLida; forma inválida ou versaoRegra < 2 -> null
  export function lerCursor(row: Record<string, unknown>): CursorLido | null
  export const FRESCOR_MS: number   // FRESCOR_H * 3_600_000, o valor que serviço e ensaio usam
  ```
  - `ficou` e `trocas` chegam do banco como `unknown`. Cada função valida a forma com guardas de tipo locais, sem Zod, para continuar pura. Forma inválida ou `versaoRegra < 2` vale linha ausente (§4, v1).
  - Ordem: passos 1–9 do §5, literalmente. `sem_troca_vista.desde` segue D-P2 (`CADENCIA_H`); `troca.entre` vem de `ficou.transicao`, e `vistoAte` de `alvo.ultimaRodadaEm`.
  - **"Linha atual" (§5 passo 7) compara `Date.parse(ultimaAtualizacaoEm) >= Date.parse(cursor.avaliadoEm)`**, nunca texto (Phil M5).
  - `RODADAS_MIN_MEDIDO`, `VALIDAS_MIN_MEDIDO` (apagada aqui), `estadosDeLeitura`, `lerEstadosDeLeitura` e `ConsultaEstado` da v1 saem. Não há consumidor fora da pasta (conferido com grep).

- [ ] **Passo 1: tabela-verdade que falha**, um `it` por linha:
  - flag off, com `delete process.env.OBS_TROCAS_CONCORRENTE` e `flagLigada: modoTrocasConcorrente({}) === 'on'` → `nao_medido/flag_off`;
  - `saiuPor: 'janela'` sem linha → `fora_da_janela` com `ultimo: sem_troca_vista` (validas > 0) ou `ultimo: null` (validas = 0);
  - `fora_da_janela` com linha `sem_desfecho` + `possivel_teste_youtube` → `ultimo.estado === 'em_andamento'`; miniatura `sem_desfecho` + `troca_observada` → `indeterminada`;
  - `sem_desfecho` com motivo `janela` → `fora_da_janela`; com `alvo_podado` → `nao_medido/saiu` com `ultimo`;
  - alvo nulo → `nao_medido/saiu`;
  - cursor com motivo `sem_publicacao` → `nao_medido/sem_publicacao`;
  - cursor ausente com publicação há 3 dias → `aprendendo`; com 5 dias → `sem_leitura`;
  - linha `em_andamento` com alvo sem rodada há 10 h → `nao_medido/sem_leitura`, com `ultimo` e `vistoAte`. **Foco 1:** 8 h 59 → estado da linha; 9 h 01 → `sem_leitura`;
  - linha `em_andamento` com `validasTitulo = 0` → `nao_medido/regra`, com `ultimo`;
  - linha v2 atual `estavel` + `possivel_teste_youtube` → `provavelmente_terminou`, com `sumidas`;
  - linha indeterminada não atual, com cursor mais novo → `sem_troca_vista`;
  - **atual × não atual com fração de segundo curta × longa** (`…58.82+00:00` contra `…58.820Z`): conta como o mesmo instante (M5);
  - troca não atual → `troca`, com `vistoAte` e `entre` de `ficou.transicao`;
  - linha `versaoRegra: 1` → tratada como ausente (`sem_troca_vista`);
  - cursor fora de dia (`avaliadoAteRodada < rodadas − 1` e avaliado há > 9 h) → `sem_leitura`;
  - `sem_troca_vista.desde`: o dia sai de `avaliadoEm − 7 × CADENCIA_H`; **trava de D-P2:** `CADENCIA_H === 6`, com a mensagem de D-P2.
- [ ] **Passo 1b: ida e volta** (`gravacao-leitura.test.ts`, Yannis I5): para os casos de teste, troca e indeterminada, `lerLinha(gravacao(r, …).linhas[0])` devolve o mesmo `veredito`/`ficouEstado`/`ficou`; `lerCursor(gravacao(...).cursor)` devolve as mesmas `validas`; linha de `versaoRegra: 1` e forma inválida → `null`.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/estado-de-leitura.test.ts test/youtube/teste-youtube/observados/gravacao-leitura.test.ts > /tmp/leitura-T7.log 2>&1; tail -30 /tmp/leitura-T7.log`.
- [ ] **Passo 3: implementar.** `passo.ts` não importa mais `VALIDAS_MIN_MEDIDO` desde a T6; aqui a constante é apagada.
- [ ] **Passo 4: rodar e ver passar** (mesmo comando, mais `pureza.test.ts` e a pasta inteira). `npx tsc --noEmit` vazio (`/tmp/leitura-T7-tsc.log`).
- [ ] **Passo 5: commit** com `feat: estado de leitura por campo da regra v2 (tabela-verdade do §5) e leitura de volta da gravação`.

---

### T8: Textos do §11

**Arquivos**
- Criar: `O/textos.ts`, `TO/textos.test.ts`. Modificar: `TO/pureza.test.ts`.

**Interfaces**
- Consome: `EstadoTitulo`, `EstadoMiniatura`, `Motivo` (T7).
- Produz:
  ```ts
  export const NOTA_PASSAGENS = 'a contagem é das nossas passagens, não da divisão de público do YouTube'
  export const AINDA_NAO_CONFERIDA = 'Ainda não conferida com os dados do YouTube.'
  export const TEXTO_MOTIVO: Record<Motivo, string>              // tabela do §11, literal
  export function quando(iso: string): string                    // '22/10 10h' em America/Sao_Paulo (Intl, sem -3 fixo)
  export function dia(iso: string): string                       // '22/10'
  export function textoTitulo(e: EstadoTitulo, o: { agoraMs: number; trocaConferida: boolean }): string
  export function textoMiniatura(e: EstadoMiniatura, o: { agoraMs: number; trocaConferida: boolean }): string
  ```
  - Textos literais do §11, preenchidos pelo estado. "há N dias" = `floor((agoraMs − última vista)/86.400.000)`. As versões aparecem entre aspas simples, no máximo 80 caracteres cada (79 + "…"), **cortadas por ponto de código**.
  - Troca que cruza o dia mostra as duas datas: "entre 20/10 19h e 21/10 01h"; no mesmo dia, "entre 20/10 13h e 19h". A miniatura usa `ate` ("trocada em 21/10").
  - `trocaConferida` é sempre `false` até o §8.2 provar (quem chama passa `false`), e então o texto leva `AINDA_NAO_CONFERIDA`.

- [ ] **Passo 1: testes que falham.** Um por estado do §11, com igualdade **exata**:
  - em andamento com 3 títulos (5/8, 3/8, …);
  - sumindo;
  - provavelmente terminou, com 1 e com 2 sumidas;
  - troca, com e sem conferida; **troca que cruza o dia**;
  - sem troca vista;
  - cada motivo de não medido, e o "Não medido agora (…). Último estado visto até 23/10: …";
  - fora da janela;
  - os 3 da miniatura (troca, indeterminada, sem troca vista);
  - versão de 100 emojis: o texto corta em 79 pontos de código + "…", sem surrogate solto.
  
  Mais estes:
  - `quando('2026-10-22T13:00:00Z') === '22/10 10h'`;
  - nenhum texto contém `venceu` nem `%`;
  - **(Yannis I2) todo texto que casa `/teste do YouTube/i` casa também `/possível teste do YouTube/i`** (a regra do §11 para estado de teste). Os literais "Não quer dizer que não houve teste antes" e "O teste de miniatura dos concorrentes não é visível para nós" (§11, §3.7) **ficam como estão**; o teste roda sobre os 14 textos da tabela e passa com eles.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/textos.test.ts > /tmp/leitura-T8.log 2>&1; tail -30 /tmp/leitura-T8.log`.
- [ ] **Passo 3: implementar.**
- [ ] **Passo 4: rodar e ver passar** (mesmo comando, mais `pureza.test.ts`). `npx tsc --noEmit` vazio.
- [ ] **Passo 5: commit** com `feat: textos da leitura dos concorrentes (§11)`.

---

### T9: `paginar.ts`, alarme de degradação e aviso da guarda (§6.1, §6.2 Aviso)

**Arquivos**
- Criar: `O/paginar.ts` (servidor), `O/alarme.ts` (puro), `O/avisos.ts` (servidor), `TO/alarme.test.ts`, `TO/avisos.test.ts`.
- Modificar: `O/passo.ts` (usa `paginar.ts`, sem mudar comportamento), `apps/web/src/lib/youtube/agenda/tarefas/avisos-pendentes.ts`; `apps/web/test/youtube/agenda/avisos-pendentes.test.ts` (o dublê `rodarAvisos` ganha `leitura: async () => RESULTADO_VAZIO`, como `nicho`); `TO/pureza.test.ts` (`alarme.ts` na lista, `paginar.ts` e `avisos.ts` em `SERVIDOR`). Se o `banco-falso` não tiver `like`, acrescentar `q.like` com a semântica `%` do Postgres.

**Interfaces**
- Consome: `titulosSuspensos` (T5), `tituloValido` (T2), `normalizarTitulo`.
- Produz:
  ```ts
  // paginar.ts: extraído de passo.ts (paginado: count 'exact', ordem estável, throw em erro, throw se o total não bater; ida)
  // alarme.ts
  export interface LeituraDia { ytId: string; rodadaId: string; lidaEm: string; http: number | null; erro: string | null; jogadorBloqueado: boolean; tituloExibido: string | null; idioma: string | null; canal: string | null }
  export interface AlvoAtivo { ytId: string; publicadoEm: string }
  export function diaBrtAnterior(agoraMs: number): { rotulo: string; inicioMs: number; fimMs: number }   // rotulo 'AAAA-MM-DD'; Intl America/Sao_Paulo
  export type Condicao = 'sem_leitura' | 'sem_titulo' | 'alvos_sem_leitura'
  export interface Avaliacao { dispara: boolean; condicao: Condicao | null; pctSemTitulo: number; alvosSemLeitura: number; alvosConsiderados: number }
  export function avaliarDegradacao(alvos: readonly AlvoAtivo[], leituras: readonly LeituraDia[], dia: { inicioMs: number; fimMs: number }): Avaliacao
     // alvos: ativos e não aprendendo em fimMs (publicação entre 4 e 30 dias); condições 1–3 na ordem do §6.1
  export function textoDegradacao(a: Avaliacao, segundoDia: boolean): string   // UM TEXTO POR a.condicao
  export function textoSuspenso(n: number): string                            // texto do §6.2 "Aviso"
  // avisos.ts
  export interface ResultadoLeituraAvisos { ativo: boolean; degradada: number; suspenso: number; expirados: number; falhas: number; semTempo: number }
  export async function enviarAvisosDaLeitura(sb: SupabaseClient, agora: Date, o: { semTempo: () => boolean; fanOut?: FanOut; env?: NodeJS.ProcessEnv }): Promise<ResultadoLeituraAvisos>
  ```
  - **Textos por condição (Phil I4, Yannis I6).** O §6.1 só dá o texto da condição 2; as outras duas são **proposta, validada pela Hanna antes do merge** (a redação final é dela; o plano só proíbe um texto para três causas). O "resto" de cada texto (consequência e "2º dia seguido…") é o do §6.1, copiado:
    - `sem_leitura`: "Leitura dos concorrentes parada ontem: a sonda não trouxe nenhuma leitura de N vídeos ativos. Os estados de título vão ficar 'não medido'." + o resto do §6.1;
    - `sem_titulo`: o texto literal do §6.1 ("34% das leituras sem título…");
    - `alvos_sem_leitura`: "Leitura dos concorrentes degradada ontem: K de N vídeos ativos ficaram sem nenhuma passagem com título." + o resto do §6.1 (contagem em vídeos, sem % nesta condição).
    - **Percentual:** floor com uma casa decimal ("20,4%"), para "acima de 20%" nunca aparecer como "20%".
  - `avisos.ts`: flag off → `{ ativo: false, … }`, sem ler nada. **`semTempo()` é chamado antes de cada site**; site pulado conta em `semTempo` (`obs_aviso_sem_tempo`) e **não expira nada**. Por site, monta os alvos ativos (`yt_watch_alvos`, `tipo = 'concorrente'`, `saiu_em is null`, mais a publicação de `competitor_videos`). As leituras de [D−1, D+1) vêm em lotes de 100 ids, nas colunas do §6.1, **por `paginado` de `paginar.ts`, com `.order('lida_em').order('id')`** (sem ordem total a paginação pula ou repete linhas e o percentual sai errado). **Qualquer erro de leitura, ou contagem divergente, LANÇA** (nunca devolve "não dispara"); a avaliação e qualquer expiração só acontecem **depois da leitura completa do site**, nunca com dado parcial. Avalia D e D−1. Se D dispara, `fanOut({ siteId, domain: 'youtube', type: 'youtube.obs_degradada', priority: 2, title: 'Leitura dos concorrentes degradada', message: textoDegradacao(aD, aDmenos1.dispara), dedupKey: 'obs-degradada:' + rotulo, payload: { condicao }, actionHref: '/cms/youtube/competitors' })` **e expira os `obs-degradada:%` abertos do site com chave diferente de `obs-degradada:<D>`** (Phil M8, para o sino não acumular D−1 e D). Se não dispara, expira todos os `obs-degradada:%` abertos (`expired_at`), no padrão de `avisos-pendentes.ts`. O mesmo vale para `titulosSuspensos` (só leituras de D com `tituloValido`), com `type: 'youtube.obs_titulo_suspenso'` e `dedupKey: 'obs-titulo-suspenso:' + rotulo`. `fan.total === 0` vai ao `Sentry.captureMessage`.
  - `rodarAvisos`: `DepsAvisos.leitura?: (sb, agora, semTempo) => Promise<ResultadoLeituraAvisos>`. A parte roda **depois** da do nicho, em `try/catch` próprio. O detalhe ganha `obs_aviso_degradada`, `obs_aviso_suspenso`, `obs_aviso_expirados`, `obs_aviso_sem_tempo` e `obs_aviso_falhou`. Falha dela **não muda** `estado` nem `motivo` (§6.1), **mas vai ao Sentry**, igual à parte do nicho: `Sentry.captureMessage('avisos_pendentes: parte da leitura falhou: ' + nome, { level: 'warning', tags: { area: 'ab-observados' } })`. A defesa contra falha em verde não pode morrer em verde.

- [ ] **Passo 1: testes que falham.** Em `alarme.test.ts`:
  - `diaBrtAnterior(Date.parse('2026-10-23T12:00:00Z'))` → `rotulo '2026-10-22'`, `inicioMs = 2026-10-22T03:00Z`, `fimMs = 2026-10-23T03:00Z`;
  - **foco 3:** uma leitura às `2026-10-23T02:59Z` está em D, e uma às `03:00Z` não está;
  - **dia sem leitura** com 1 alvo ativo → `sem_leitura`;
  - leitura `http 200`, sem erro e sem título, entra nos 20% (21% → `sem_titulo`; 20% → não);
  - alvos sem rodada válida de título > 10% → `alvos_sem_leitura`;
  - alvo de 31 dias e alvo de 2 dias ficam fora de `alvosConsiderados`;
  - **um texto por condição, com igualdade exata** (1º e 2º dia): `sem_leitura`, `sem_titulo` (literal do §6.1), `alvos_sem_leitura`; "20,4%" aparece com uma casa e floor; `textoSuspenso(5)` literal.
  
  Em `avisos.test.ts` (banco falso, `fanOut` injetado):
  - parte rodada 2× no mesmo dia → `fanOut` com a mesma `dedupKey` (1 chave);
  - em dois dias seguidos → 2 chaves, o 2º texto acrescenta "2º dia seguido…", **e o `obs-degradada:D−1` aberto é expirado ao disparar D** (idem `obs-titulo-suspenso`);
  - dia abaixo do limiar → `expired_at` gravado nos `obs-degradada:*` abertos;
  - `obs-titulo-suspenso:*` expira no 1º dia sem suspensos;
  - `fan.total === 0` → Sentry chamado;
  - flag off → 0 consultas;
  - **2ª página com erro (Phil I3) → lança, nenhum `fanOut`, nenhuma expiração; o mesmo para o banco falso que falha no 2º lote (Yannis I6): 0 `update` em `notifications`;**
  - contagem de `count: 'exact'` divergente das linhas lidas → lança;
  - `semTempo` verdadeiro → 0 consultas do site, 0 expirados, `semTempo = 1`.
  
  Em `avisos-pendentes.test.ts`: `leitura` que lança → `estado` e `motivo` iguais aos de quando ela não lança, `detalhe.obs_aviso_falhou === 1`, o lembrete do dia 14 ainda sai, **e `Sentry.captureMessage` é chamado com `tags.area === 'ab-observados'`**.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/alarme.test.ts test/youtube/teste-youtube/observados/avisos.test.ts test/youtube/agenda/avisos-pendentes.test.ts > /tmp/leitura-T9.log 2>&1; tail -30 /tmp/leitura-T9.log`.
- [ ] **Passo 3: implementar.** Primeiro extrair `paginado`/`ida` para `paginar.ts` (a pasta `observados` continua verde, comportamento igual); depois o resto. Conferir se `fanOutToSiteAdminsDetailed` aceita os dois `type` novos. Se houver uma união fechada de tipos de notificação (grep `youtube.native_lembrete` em `src/lib/notifications`), acrescentar os dois ali.
- [ ] **Passo 4: rodar e ver passar** (mesmo comando, mais a pasta `observados`, `pureza.test.ts` e `test/integration/f2-avisos-sino.test.ts`, que pula sem banco local). `npx tsc --noEmit` vazio.
- [ ] **Passo 5: commit** com `feat: alarme de degradação e aviso de título suspenso da leitura dos concorrentes`.

---

### T10: Ensaio a seco (§8.0)

**Arquivos**
- Modificar: `O/ensaio.ts` (acrescenta `ensaiar`), `TO/replay.test.ts` (um caso que roda `ensaiar` sobre a fixture).
- Criar: `apps/web/scripts/obs-dry-run.ts`, `apps/web/scripts/obs-dry-run.sql`.

**Interfaces**
- Consome: `carregarExport` (T1), `inferirComGuarda`, `ehPlaceholder` (T5), `gravacao` (T6), `estadoTitulo`/`estadoMiniatura`/`lerLinha`/`lerCursor` (T7), `textoTitulo`/`textoMiniatura` (T8), `avaliarDegradacao`, `diaBrtAnterior` (T9), `titulosSuspensos`.
- Produz:
  ```ts
  export interface LinhaDoEnsaio { ytId: string; titulo: EstadoTitulo; miniatura: EstadoMiniatura; textoTitulo: string; textoMiniatura: string; suspensos: string[] }
  export interface RelatorioEnsaio { agora: string; alvos: LinhaDoEnsaio[]; cobertura: { elegiveis: number; tituloMedido: number; miniaturaMedida: number; aprendendo: number; foraDaJanela: number }; suspensosDoDia: string[]; degradacao: Avaliacao; contaminacao: number }
  export async function ensaiar(alvos: ReadonlyMap<string, AlvoExport>, o: { agoraMs: number }): Promise<RelatorioEnsaio>
  export function relatorioEmTexto(r: RelatorioEnsaio): string
  ```
  - **A linha e o cursor vêm de `gravacao()` (a mesma do `passo.ts`) e voltam por `lerLinha`/`lerCursor`**; o ensaio não reimplementa nada do que o `passo.ts` grava (Yannis I5), com `flagLigada: true`.
  - A `conferir` em memória usa **um índice montado uma vez**, `Map<bruto, { ytId; tMs; canal }[]>`, O(L), consultado por bruto com filtro de tempo ± 24 h e dos **outros** alvos (Yannis M5); decide com `ehPlaceholder` e o `canal` da linha (D-P8).
  - **"Elegíveis" (§8.1, 1; Phil I5) = o mesmo denominador do §8.2:** `saiu_em is null`, `alvo_rodadas >= 8` e não aprendendo, quando as colunas do alvo existem no export; só na fixture (que não as tem) o ensaio deduz "ativo" de publicação + 30 d e `foraDaJanela` de `publicadoEm + 30 d <= agora`, e escreve isso no relatório. Aprendendo e fora da janela são contados à parte.
  - `contaminacao` conta as versões emitidas vistas em ≥ 2 outros vídeos (§8.1, 2).
- `obs-dry-run.sql`: o `select` de `$EV/yannis-export-replay.sql` + a coluna `(select v.competitor_channel_id from public.competitor_videos v where v.video_id = l.youtube_video_id order by v.published_at limit 1) as canal` **+ `a.saiu_em, a.saiu_por, a.rodadas as alvo_rodadas, a.ultima_rodada_em`** (o join com `yt_watch_alvos` já existe), com o filtro `l.lida_em >= now() - interval '31 days'` no lugar da data fixa, embrulhado em **`select json_build_object('colunas', json_build_array('yt','rodada_id',…), 'linhas', json_agg(json_build_array(t.yt, t.rodada_id, …))) from (…) t;`** (formato colunar que `extrairLinhas` já aceita; sem as chaves repetidas). O SQL traz dois literais no topo, em comentário (`:ini` e `:fim`), trocados por `sed` na linha de comando, com `lida_em >= '<ini>' and lida_em < '<fim>'` no lugar do `interval '31 days'`; o cabeçalho traz **por padrão 4 arquivos semanais** (Phil P2). O cabeçalho em comentário diz que é só leitura e traz o comando do controlador: **`npx supabase db query --linked --agent=no -o json -f apps/web/scripts/obs-dry-run.sql > /tmp/obs-export.json`** (sem `--agent=no` a CLI devolve o envelope de agente e `extrairLinhas` lança). **Antes de rodar o script**, o controlador confere `wc -c /tmp/obs-export.json` de cada um dos 4 arquivos (esperado ~22 MB no total, ~5 MB cada) e as 3 últimas linhas de cada; o script aceita vários arquivos e `carregarExport` une os alvos que aparecem em mais de um (teste com o mesmo `yt` em 2 arquivos: `rodadas` e leituras somam, sem duplicar rodada).
- Script: `cd apps/web && npx tsx --require ./scripts/_sem-server-only.cjs scripts/obs-dry-run.ts <export.json…> [--agora <ISO>]`. Lê o(s) arquivo(s), chama `extrairLinhas`, `carregarExport` e `ensaiar`, e imprime `relatorioEmTexto`. O padrão de `--agora` é a maior `lida_em` do export. **Nada é gravado**: o script não importa cliente Supabase.

- [ ] **Passo 1: teste que falha** em `replay.test.ts` (Yannis M6). `ensaiar` sobre a fixture dá `contaminacao === 0`; as **contagens exatas** de `cobertura` (`elegiveis`, `tituloMedido`, `miniaturaMedida`, `aprendendo`, `foraDaJanela`) calculadas uma vez a partir da tabela da T2 e escritas no teste; cada `textoTitulo` não é vazio; os estados batem com os da T2. O "≥ 90%" é critério do ensaio de produção (§8.1), **não** da CI. Mais: `lerLinha(gravacao(...).linhas[i])` é o que alimenta `estadoTitulo` no ensaio (um teste troca `gravacao` por um dublê que zera as `validas` e o ensaio acompanha), e `extrairLinhas` lê a amostra real da CLI (`amostra-cli.json`, gerada com `--agent=no`: prova o formato do comando que será usado). **Um segundo teste (Phil M-f) com um envelope de agente montado à mão prova que `extrairLinhas` lança `export ilegível` com a dica "rode com --agent=no".**
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/replay.test.ts > /tmp/leitura-T10.log 2>&1; tail -20 /tmp/leitura-T10.log`.
- [ ] **Passo 3: implementar** `ensaiar`, `relatorioEmTexto`, o script e o SQL.
- [ ] **Passo 4: rodar e ver passar.** Depois, o script sobre a fixture: `cd apps/web && npx tsx --require ./scripts/_sem-server-only.cjs scripts/obs-dry-run.ts test/youtube/teste-youtube/observados/fixtures/replay-23-10.json > /tmp/leitura-T10-ensaio.txt 2>&1; head -40 /tmp/leitura-T10-ensaio.txt`. O `extrairLinhas` reconhece o formato colunar `{ colunas, linhas }` (caso da T1). Esperado: 35 alvos, o resumo de cobertura e 0 contaminação. `npx tsc --noEmit` vazio.
- [ ] **Passo 5: commit** com `feat: ensaio a seco da leitura dos concorrentes (script só de leitura)`.

---

### T11: Fecho do envio A

- [ ] **Passo 1: suíte da área.** `cd /Users/figueiredo/Workspace/bt-leitura/apps/web && npx vitest run test/youtube test/mcp test/lib/pipeline > /tmp/leitura-T11.log 2>&1; grep -E "Test Files|Tests|FAIL" /tmp/leitura-T11.log | head -20`. Esperado: 0 FAIL.
- [ ] **Passo 2: typecheck.** `npx tsc --noEmit > /tmp/leitura-T11-tsc.log 2>&1; tail -5 /tmp/leitura-T11-tsc.log`. Esperado: vazio. Na raiz: `npm run build:packages` não é necessário, porque nada em `packages/` mudou.
- [ ] **Passo 3: nada fora do escopo.** `git diff --stat origin/staging -- apps/web/src/lib/youtube/watch supabase apps/web/src/lib/youtube/teste-youtube/titulo.ts apps/web/src/lib/youtube/teste-youtube/tipos.ts` sai **vazio** (sonda, watch, banco e detector do dono intocados). E `grep -rn "describe.skip\|it.skip" apps/web/test/youtube/teste-youtube/observados` sai **vazio**.
- [ ] **Passo 4: data da poda (§7; Phil I7).** A poda (`yt_watch_poda`, `supabase/migrations/20261018000005…`) apaga quando `saiu_em < agora − 30 d` **e** `reter_ate` é nulo ou já passou. O controlador roda, só leitura, e anota a data exata no ledger (esperado: `primeira_poda` entre 17/11 e 18/11):
  ```sql
  select min(greatest(a.saiu_em + interval '30 days', coalesce(a.reter_ate, '-infinity'::timestamptz))) as primeira_poda,
         count(*) filter (where a.saiu_em + interval '30 days' < now() + interval '14 days') as alvos_podados_ate_14d,
         (select count(*) from yt_watch_readings r join yt_watch_alvos b using (site_id, youtube_video_id)
           where b.tipo = 'concorrente' and b.saiu_em + interval '30 days' < now() + interval '14 days') as leituras_podadas_ate_14d
    from yt_watch_alvos a where a.tipo = 'concorrente' and a.saiu_em is not null;
  ```
  O ledger registra que a poda leva **só o bruto de alvo já fora da janela**, e que, com a flag off até lá, esses alvos nunca terão estado inferido (perda aceita, escrita).
- [ ] **Passo 5:** sem commit novo se nada mudou. O relatório ao controlador traz a lista de commits A (T1–T10) e o resultado do Passo 1.

**Pronto quando** a CI local está verde nas pastas tocadas, o replay dá 35/35 (título e miniatura) e o diff não toca sonda, watch, banco nem detector.

### Conferências do controlador no deploy (só leitura; Phil §6)

| Quando | Consulta | Esperado |
|---|---|---|
| Promoção do A, D+0 | `select count(*) from ab_native_observados where versao_regra = 2;` e `select count(*) from ab_native_obs_cursor where avaliado_em > '<hora do deploy>';` | 0 e 0 (flag off: nada gravado) |
| Mesmo dia | a SQL do T11 passo 4 | `primeira_poda` entre 17/11 e 18/11; anotar no ledger |
| Dia de ligar a flag, antes | ensaio a seco com o export da T10; `wc -c` do export | cobertura ≥ 0,90 / ≥ 0,80 no denominador do §8.2; contaminação 0 |
| D+1 ligado | SQL de cobertura do §8.2 | ≥ 0,900 e ≥ 0,800; diferença para o ensaio ≤ 0,03 (mesmo denominador) |
| D+1 ligado, 09:05 BRT | `select dedup_key, count(*) from notifications where dedup_key like 'obs-%' and created_at > now() - interval '1 day' group by 1;` | no máximo 1 chave `obs-degradada:<D>` e 1 `obs-titulo-suspenso:<D>` (contagem = nº de admins) |
| Véspera de ligar a flag (Phil M-d) | `explain (analyze, buffers)` de **uma** consulta da guarda com 100 ids de produção | `Index Scan` ou `Bitmap` em `yt_watch_readings_video_tempo`, < 100 ms (a conta de ~10 ms é estimativa) |
| D+1 ligado (Phil M-d) | detalhe do último disparo do passo, onde os `obs_*` já são lidos | `obs_falhou = 0`; `obs_titulo_suspenso` e `obs_versoes_demais` anotados no ledger (subida repentina = guarda suspendendo título real) |
| D+1 ligado | `select count(*) from ab_native_observados where versao_regra = 2 and campo = 'miniatura' and veredito = 'possivel_teste_youtube';` | 0 |

---

### B0: Portão (decisão, não código)

Fatos: seção "Chave por pessoa", acima. **O executor não começa B1 sem o registro, no ledger, da decisão do dono (ou o padrão, se ele não responder), com a data.** As perguntas P1–P3 estão em "◆ Dono decide antes do B".

- **(a') recomendada:** B1 e B2 agora (no build que liga a flag, ≥ 26/10, ou antes se sobrar slot). Fica registrado no ledger que o Claude Code do dono passa a ver `get_observed` **pela chave permanente que já está instalada nele** (`~/.claude.json`): desvio **anterior a este plano e não criado por ele**; dívida declarada, dono: Thiago; gatilho: montar o servidor do perfil `observatorio_leitura`. Custo ~80K tokens, risco de dado zero.
- **(b)** B espera inteiro até o servidor do perfil existir: mesmo custo em tokens mais tarde, um build a mais, e o Cowork fica sem a leitura por prazo **sem estimativa**.
- **Critério de aceite de B, partido em dois (Hanna 2; §8.3):**
  - **B-Cowork pronto:** o teste da B2 prova o mesmo JSON na rota e no MCP; com a flag off o Cowork responde "Leitura de concorrentes desligada"; com a flag on, o controlador pergunta no Cowork "quais concorrentes estão testando título agora?" e a contagem bate com o ensaio do dia (§8.0), com "possível" em todo teste. Quem confere: controlador; o dono confirma uma vez.
  - **B-paridade (pendente, fora deste plano, no backlog):** a mesma pergunta no Claude Code, **com a chave pessoal do dono**, dá a mesma contagem. **Gatilho:** o servidor do perfil montado numa rota e a chave pessoal lendo. Enquanto isso, a resposta do Claude Code pela chave permanente **não conta** como cumprimento do §8.3. Backlog 2: sair da chave permanente no Claude Code; gatilho: a chave pessoal lendo `/api/mcp` com teste cruzado verde.

---

### B1: Serviço, rota, registro, doc e contagens (Pipeline Integrity)

**Arquivos**
- Criar: `apps/web/src/lib/pipeline/services/leitura-concorrentes.ts`, `apps/web/src/app/api/pipeline/youtube/competitors/observed/route.ts`, `apps/web/test/lib/pipeline/leitura-concorrentes.test.ts`.
- Modificar: `apps/web/src/lib/pipeline/api-registry.ts`, onde entra o endpoint e o `endpoint_count` do YOUTUBE passa de **38 → 39**; `apps/web/src/lib/pipeline/leitura-rotas.ts`, com o padrão `'/api/pipeline/youtube/competitors/observed'` em ordem alfabética; **`apps/web/data/pipeline-docs/cowork-docs-youtube.md`** (seção `### GET /api/pipeline/youtube/competitors/observed` depois de `signals/:id/dismiss`; a doc mora aqui porque a Pipeline Integrity pede rota + registro + doc juntos); **`apps/web/test/mcp/youtube-cowork-docs-observatorio.test.ts` (linhas ~336–337: `38 → 39`, as duas)** e **`apps/web/test/mcp/mcp-registry-sync.test.ts` (linha ~29: `130 → 131`, com o comentário `youtube(39)`)** (Yannis I3).

**Interfaces**
- Consome: `estadoTitulo`, `estadoMiniatura`, `lerLinha`, `lerCursor`, `FRESCOR_MS` (T7); `textoTitulo`, `textoMiniatura`, `NOTA_PASSAGENS`, `TEXTO_MOTIVO` (T8); `modoTrocasConcorrente`; `ServiceContext` (`services/types`). **O serviço não reimplementa a conversão banco → leitura: usa `lerLinha`/`lerCursor`.**
- Produz:
  ```ts
  export interface ItemLeitura { canal: string; canal_id: string; video_id: string; titulo_video: string | null; campo: 'titulo' | 'miniatura'; estado: string; texto: string; visto_ate: string | null }
  export type RespostaLeitura =
    | { ligada: false; motivo: 'flag_off'; resumo: 'Leitura de concorrentes desligada' }
    | { ligada: true; resumo: string; resumo_miniatura: string; nota: string; contagem: { titulo: ContagemTitulo; nao_medido_por_motivo: Record<string, number>; miniatura: ContagemMiniatura }; fora_da_janela: number; itens: ItemLeitura[]; janela_dias: 14 }
  // ContagemTitulo:    chaves em_andamento, sumindo, provavelmente_terminou, troca, sem_troca_vista, nao_medido  (soma = N)
  // ContagemMiniatura: chaves troca, indeterminada, sem_troca_vista, nao_medido                                   (soma = N)
  export async function lerLeituraDosConcorrentes(ctx: ServiceContext, o: { agoraMs: number; env?: NodeJS.ProcessEnv }): Promise<{ data: RespostaLeitura }>
  ```
  - Lê, só do `ctx.siteId` e com paginação: `yt_watch_alvos` (`tipo = 'concorrente'`), `ab_native_obs_cursor` e `ab_native_observados` (`versao_regra >= 2`) em lotes de 100 ids, e `competitor_videos` com `competitor_channels` (título do vídeo, nome do canal, publicação).
  - **N (Phil M9, Yannis M8, Phil P1) = alvos de concorrente do site com `saiu_em is null` cujo canal NÃO tem `removal_requested_at`. Vídeo sem linha em `competitor_videos`, ou com `published_at` nulo, ENTRA em N como `nao_medido/sem_publicacao`** (ausência nunca vira "não existe"). **Canal com `removal_requested_at` é EXCLUÍDO da resposta e da contagem N** (a resposta vai a um terceiro, o Cowork); o serviço distingue os dois casos lendo `competitor_channels`, e não pelo ausente do mapa. `fora_da_janela` (alvo que saiu) **não entra em N**: vai no campo `fora_da_janela` e aparece na lista só quando `ultimo` é um estado listado e `vistoAte` está nos 14 dias, com o texto "Fora da observação…" do §11. **O item leva `estado: 'fora_da_janela'`, `fora_da_observacao: true` e o campo `ultimo` (o estado base), vem depois dos itens de N na ordenação** (Yannis R5, Phil M-c); o serviço lê só alvos com `saiu_por = 'janela'` e `saiu_em` nos últimos 14 dias. Quando F > 0, o `resumo` acrescenta ", mais F que já saíram da observação" (concordância de número testada), e o `resumo` não conta o item em "com possível teste". `sem_troca_vista` e `nao_medido` entram na `contagem`, nunca na lista.
  - Itens: os estados `em_andamento`, `sumindo`/`provavelmente_terminou` e `troca` (título) e `troca`/`indeterminada` (miniatura) com `visto_ate` nos últimos 14 dias. A ordem é `em_andamento` primeiro, depois `visto_ate` decrescente.
  - Resumo, literal do §7 **com concordância (D-P5)**: "N vídeo(s) de concorrentes observado(s): X com possível teste em andamento (inclui os que estão sumindo), Y provavelmente terminado(s), Z troca(s), W não medido(s) (motivos)", em que `(motivos)` = `aprendendo 7, saiu 14`, motivos com 0 omitidos, ordem de `Motivo`. Singular quando o número é 1 em cada termo. A 2ª linha, `resumo_miniatura`: "Miniatura: Z troca(s), K alternando sem dar para afirmar troca." O `resumo` conta **pelo título**.
  - Erro de banco vira `PipelineServiceError` (500), nunca uma lista vazia.
- Rota: copiar o formato de `competitors/signals/route.ts`, com `authenticateRead`, `pipelineSuccess(data, 200, auth)` e `serviceErrorToResponse`. `agoraMs = Date.now()` fica na rota, nunca no serviço.
- Registro: `{ method: 'GET', path: '/api/pipeline/youtube/competitors/observed', summary: "Competitor title/thumbnail reading (rule v2): per video 'possible YouTube test' in progress, fading, probably ended, or swap, each with the fixed sentence and seen-until; not-measured only counted, with reason. Off flag answers 'Leitura de concorrentes desligada'", auth: 'read' }`.
- Doc do Cowork: forma da resposta (os dois ramos de `RespostaLeitura`), um exemplo curto, a "Regra para o Cowork" do §7 (as cinco linhas literais) e a frase "Depois de editar esta doc, rodar de novo o seed da referência do Cowork (controlador)". **Atenção (Yannis I3):** em `test/mcp/youtube-cowork-docs.test.ts:21-31` a seção "Coaching" termina no caractere **7999** de um limite de 8000. **Nada pode ser inserido antes do caractere 8000**, nem na tabela de endpoints do topo; a posição acima (~caractere 49 mil) é segura.

- [ ] **Passo 1: testes que falham** (banco falso de `test/youtube/observatorio/sinais/fake-sb` ou o `banco-falso` do registro):
  - flag off (com `delete process.env.OBS_TROCAS_CONCORRENTE` e sem `env`) → `{ ligada: false, motivo: 'flag_off' }`, **sem** `itens`;
  - flag on com 3 alvos (teste, troca e aprendendo) → `resumo === '3 vídeos de concorrentes observados: 1 com possível teste em andamento, 0 provavelmente terminados, 1 troca, 1 não medido (aprendendo 1)'`, com 2 itens e cada `texto` igual a `textoTitulo(...)`; com 1 alvo só: "1 vídeo de concorrentes observado…" (concordância);
  - **a soma das chaves de `contagem.titulo` = N** e a de `contagem.miniatura` = N;
  - **canal com `removal_requested_at` → 0 itens dele e fora de N** (nem na soma);
  - 1 alvo fora da janela com `ultimo` em andamento há 3 dias → na lista com `itens[i].estado === 'fora_da_janela'` e `fora_da_observacao === true`, **fora de N**, contado em `fora_da_janela`, não contado em "X com possível teste", e o resumo traz ", mais 1 que já saiu da observação";
  - **(Phil P1)** 1 alvo com `published_at` nulo e 1 sem linha em `competitor_videos` → `nao_medido_por_motivo.sem_publicacao === 2` e a soma das chaves continua = N; 1 alvo de canal com remoção pedida → fora de N;
  - item com `visto_ate` de 15 dias atrás não entra na lista, mas entra na contagem;
  - linha `versao_regra = 1` é ignorada;
  - erro de banco → lança `PipelineServiceError`;
  - `api-registry.test.ts`, `leitura-rotas.test.ts`, `registry-completeness.test.ts`, `youtube-cowork-docs-observatorio.test.ts`, `mcp-registry-sync.test.ts` e `youtube-cowork-docs.test.ts` (o de 8000) existentes, verdes.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/lib/pipeline/leitura-concorrentes.test.ts test/lib/pipeline/api-registry.test.ts test/lib/pipeline/leitura-rotas.test.ts test/api/pipeline/registry-completeness.test.ts test/mcp/youtube-cowork-docs-observatorio.test.ts test/mcp/mcp-registry-sync.test.ts test/mcp/youtube-cowork-docs.test.ts > /tmp/leitura-B1.log 2>&1; tail -30 /tmp/leitura-B1.log`. Se `leitura-rotas.test.ts` morar em outra pasta, achar com `find apps/web -name leitura-rotas.test.ts`.
- [ ] **Passo 3: implementar** o serviço, a rota, o registro, o padrão de rota, a doc e as contagens (38 → 39; 130 → 131).
- [ ] **Passo 4: rodar e ver passar** (mesmo comando). `npx tsc --noEmit` vazio.
- [ ] **Passo 5: commit** com `feat: GET competitors/observed, leitura dos concorrentes para o Cowork`.

---

### B2: Ação MCP `get_observed`

**Arquivos**
- Modificar: `apps/web/src/lib/pipeline/mcp/tools.ts` (`YoutubeObservatoryShape.action` ganha `'get_observed'`, e a descrição ganha a frase abaixo); `apps/web/src/lib/pipeline/mcp/services/youtube-observatory.ts` (o `case 'get_observed'` chama `lerLeituraDosConcorrentes(buildCtx(), { agoraMs: Date.now() })` e devolve sem indentação, como `get_signals`; a mensagem de ação desconhecida lista a nova ação). A doc do Cowork já foi na B1.
- Testes: `apps/web/test/mcp/youtube-observatory-observed.test.ts` (novo); os existentes `youtube-mcp-tools.test.ts` e `youtube-observatory-parametros.test.ts`.

**Interfaces**
- Consome: `lerLeituraDosConcorrentes` (B1). `PARAMETROS_LIDOS` não muda, porque a ação não tem parâmetro. `tools.size === 24` continua (o endpoint cai em `youtube_observatory` por `auto-register.ts:134`).
- Frase da descrição da ação: `get_observed: competitor title/thumbnail reading. Quote each item's texto as is; never drop "possível"/"provavelmente", never say a version won, "não medido" is never zero nor "did not test", "provavelmente terminou" can reopen. Off flag: say "leitura de concorrentes desligada".`
- **Tamanho (Yannis M7):** o teto de texto da ferramenta é 60.000 caracteres (`youtube-observatory-parametros.test.ts:129`). Mesmo padrão do `get_signals` (`observatorio/sinais/leitura.ts:43`): cortar a **lista**, nunca a contagem, e devolver `itens_omitidos`.

- [ ] **Passo 1: teste que falha** (`youtube-observatory-observed.test.ts`, no molde de `youtube-observatory-signals.test.ts`, com `getMcpContext` e `getSupabaseServiceClient` mockados):
  - `youtubeObservatory({ action: 'get_observed' })` com a flag off → texto JSON com `ligada: false`;
  - com a flag on e o mesmo banco falso da B1 → o **mesmo** JSON que `lerLeituraDosConcorrentes` devolve para a rota (paridade rota × MCP pela mesma função);
  - **150 itens → texto < `LIMITE_DE_TEXTO` e `itens_omitidos > 0`, e a `contagem` igual à da rota**;
  - ação desconhecida → a mensagem cita `get_observed`.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/mcp/youtube-observatory-observed.test.ts test/mcp/youtube-mcp-tools.test.ts test/mcp/youtube-observatory-parametros.test.ts > /tmp/leitura-B2.log 2>&1; tail -30 /tmp/leitura-B2.log`.
- [ ] **Passo 3: implementar** a ação.
- [ ] **Passo 4: rodar e ver passar** (mesmo comando, mais `test/lib/pipeline` e `test/mcp`). `npx tsc --noEmit` vazio.
- [ ] **Passo 5: commit** com `feat: ação get_observed no youtube_observatory`.

**Pronto quando** a rota e o MCP devolvem o mesmo JSON para o mesmo banco, a doc tem as cinco regras e os testes de registro, ferramentas e doc estão verdes. Isso cumpre **B-Cowork pronto** (B0); **B-paridade** fica no backlog.

**Depois de B2 (controlador, fora deste plano):** promover, rodar o seed da referência do Cowork (`scripts/seed-pipeline-reference.ts`, que escreve em produção) e conferir pelo Cowork (§8.3, B-Cowork). O Claude Code com chave pessoal depende da frente do P3.

---

## Cobertura do spec (autoconferência)

| Spec | Tarefa |
|---|---|
| §3.1 validade, idioma, suspenso | T2, T5 |
| §3.2 janela, mínimos, 72 h, frescor | T2 |
| §3.3 caminho (b), contrato | T2, T4 |
| §3.4–§3.5 teste, X único, última janela, R, W⁻ | T2 |
| §3.6 taxas | T4 |
| §3.7 miniatura, Hamming 7–9, proibição | T2 (regra), T3 (montagem e replay) |
| §3.8 aprendendo, fora da janela | T7, T10 |
| §4 tabela, invariantes, `trocas`, teto 8, `ficou`, `primeira_troca_em`, `agora` único, cursor `> 0` | T3, T6 |
| §5 tipos e ordem 1–9 | T7 |
| §6.1 alarme | T9 |
| §6.2 guarda e aviso | T5, T6, T9 |
| §7 envio A / flag / envio B / chave | T1–T11, B0–B2 |
| §8.0 ensaio a seco | T10 |
| §8.1–§8.2 critérios | controlador e Gio; T10 dá a cobertura e a contaminação |
| §8.3 envio B pronto | B2 (B-Cowork); B-paridade no backlog (B0) |
| §9.1–§9.6 | T2 (9.1, 9.2 de regra), T3 (9.6, miniatura), T4 (9.3, 9.4), T5/T6 (9.2 da guarda), T7 (9.5), T9 (9.2 do alarme) |
| §11 textos | T8 |

## Registro r2 (achado → onde entrou)

| Achado | Onde entrou |
|---|---|
| Phil I1 (miniatura no replay, `decide_unica` literal) | T2 (algoritmo, item "Sem janela de teste", teste `{X,Y}`), T3 (replay 2/4/29) |
| Phil I2 (erro da guarda lança, `site_id`, timeout) | T6 (`conferir`, teste de `error`/`data: null`), foco 6 |
| Phil I3 (paginação do alarme: ordem, contagem, erro) | T9 (`paginar.ts`, `.order`, lança, testes) |
| Phil I4 (texto por condição, floor, uma casa) | T9 (textos por condição, "20,4%") |
| Phil I5 (formato da CLI, denominador, tamanho do export) | Preparação (amostra-cli), T1 (`extrairLinhas`, campos do alvo), T10 (SQL com `--agent=no`, `wc -c`, metades, elegíveis) |
| Phil I6 (simulação 5.000 alvos, semente fixa) | T4 |
| Phil I7 (SQL da poda com `reter_ate`) | T11 passo 4, "Contas corrigidas" |
| Phil M1 (`isoDoBanco` com fração curta) | T1 |
| Phil M2 (canal nulo; validade em `titulosSuspensos`) | D-P8, T5 |
| Phil M3 (corte por ponto de código, 8 × 300 emojis) | Restrições globais, T3, T8 |
| Phil M4 (troca limpa em 28 rodadas) | T2 |
| Phil M5 (`Date.parse` na linha atual) | T7 |
| Phil M6 (`rodadasExigidas(0) === 0`) | T2 |
| Phil M7 (conta da guarda, 4 lotes) | "Contas corrigidas" |
| Phil M8 (expirar `obs-*` diferentes de D) | T9 |
| Phil M9 (remoção pedida excluída; N; soma testada) | D-P5, B1 |
| Phil M10 / D-P2 (trava de cadência) | D-P2, constante `CADENCIA_H`, T7 |
| Phil D-P1 (`de` conta blips; miniatura usa `ate`) | D-P1, T3, T8 |
| Phil D-P4 (prova vazia; idioma nulo; maioria depois do suspenso) | D-P4, T2 |
| Yannis I1 (árvore verde, sequência de remoção) | Restrições globais, tabela "Sequência de remoção", T1, T2, T3, T6, T7, T11 |
| Yannis I2 (asserção do "possível") | T8 |
| Yannis I3 (contagens 38/130, doc na B1, folga de 8000) | B1 |
| Yannis I4 (chave permanente no Claude Code) | "Chave por pessoa", B0, P1–P3 |
| Yannis I5 (`gravacao`/`lerLinha`/`lerCursor` únicos) | D-P7, T6, T7, T10, B1 |
| Yannis I6 (textos 1 e 3, Sentry no catch, erro lança, `semTempo`) | T9 |
| Yannis M1 (D-P3 fecha com `sem_desfecho`) | D-P3, T6 |
| Yannis M2 (`agora` da fixture, `isoDoBanco`) | T1, T2 |
| Yannis M3 (canal nulo) | D-P8, T5 |
| Yannis M4 (erro da guarda lança, `site_id`) | T6 |
| Yannis M5 (índice por bruto no ensaio) | T10 |
| Yannis M6 (contagens exatas, não 90% na CI) | T10 |
| Yannis M7 (tamanho da resposta MCP) | B2 |
| Yannis M8 (universo de N, `fora_da_janela`) | D-P5, B1 |
| Yannis M9 (`rodadasDaMiniatura`, maioria após suspensos, dia cruzado) | T3, T2, T8 |
| Yannis D-P2 (dívida declarada) | D-P2 |
| Hanna 1 (B0 com o fato da chave permanente; opção (a')) | "Chave por pessoa", B0 |
| Hanna 2 (§8.3 partido em B-Cowork e B-paridade, backlog com gatilho) | B0, B2 |
| Hanna 3 (B no build de ligar a flag, ≥ 26/10) | "Calendário" |
| Hanna 4 (D-P2 com trava num teste) | D-P2, T7 |
| Hanna 5 (concordância no resumo) | D-P5, B1 |
| Hanna P1–P3 (◆ dono decide antes do B, com padrão) | "Dono decide antes do B" |
| Decisões do controlador (D-P3 do Yannis; gravação única; M9 do Phil no resumo) | D-P3, D-P7, D-P5 |
| Estimativas | "Ordem e custo": A ≈ 500K, B ≈ 80K |

## Registro r2.1 (achado → onde entrou)

| Achado | Onde entrou |
|---|---|
| Phil P1 (N inclui sem publicação) | B1 (definição de N e testes) |
| Phil P2 (export colunar, 4 arquivos, união) | "Contas corrigidas", T10 |
| Phil M-a = Yannis R3 (`cursorSemPublicacao`) | D-P7, T6 |
| Phil M-b (canal nulo em `titulosSuspensos`; união dos lotes) | T5, T6 |
| Phil M-c = Yannis R5 (`fora_da_janela` com `estado` próprio, `fora_da_observacao`) | B1 |
| Phil M-d (conferências do deploy) | "Conferências do controlador" |
| Phil M-e (regex do baixo solto) | T3 |
| Phil M-f (envelope de agente, dica `--agent=no`) | T10 |
| Yannis R1 (`avaliado_motivo`, teste das colunas) | D-P7, T6 |
| Yannis R2 (`saiuPor` por `saiuEm`) | D-P7, T6 |
| Yannis R4 (`VALIDAS_MIN_MEDIDO = 4` literal) | Sequência de remoção, T3 |
| Yannis R6 (`mundo()` com `titulo_exibido`, ≤ 5 `skip`) | T3 |
| Yannis R7 (frescor do alvo saído) | Dívida declarada |
| Yannis (conferir `estadosDeLeitura` antes do merge) | Dívida declarada e conferência de merge |
