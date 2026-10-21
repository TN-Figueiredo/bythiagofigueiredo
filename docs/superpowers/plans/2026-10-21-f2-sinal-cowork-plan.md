# F2 (Sinal via Cowork) Implementation Plan — r2

## r2: achado → onde (pareceres de Hanna 84, Phil 82, Yannis 82 sobre a r1)

| Achado | Onde na r2 |
|---|---|
| Hanna H1 (push F2-1 sem valor) | Envios: F2-1 vira `db:push:prod` sem build próprio |
| Hanna H2 (portão no fim) | T6b (portão sobe para depois da T6); F2-2 não sobe sem portão |
| Hanna H3 = Yannis C5 (Claude Code sem caminho) | T8: ação só de leitura `sugestoes` em `observatorio_leitura`; Constraints; Fora deste plano |
| Hanna H4 + Yannis C3/C7 + Phil 1 + Phil M1 (sino, resumo, expiração: **um mecanismo**) | **Mecanismo único** abaixo; T4 (`niche_signals_expirar`), T9 (baseline, dedup do resumo, `acao_do_dono`) |
| Hanna H5, H6 | tabela de envios (coluna "O dono vê", datas 25–28/10) |
| Phil 2 (`tudo-respondido`) | T8 `ListaDeSinais`, invariante `n = 0 ⇒ motivoVazio != null` |
| Phil 3 (aliases > 1.000 linhas) | T6 leitura paginada + `semente_incompleta` |
| Phil 4 (`desc`, não `description`) | T6 |
| Phil 5 (evento sucessivo com os mesmos outliers) | T4/T5: âncoras recentes |
| Phil 6 (janela de 14 d real) | T4 `niche_outliers_vistos`; T5 |
| Phil 7 + Yannis C2 (medida antes de fixar; qual `mult`) | `REGRA_SINAIS` provisória marcada; `mult = vpd7/median7`; T1 imprime distribuições; `parecido` só no resumo |
| Phil M2, M3, M5, M6, M7 | T2 (deriva, v2 com delete), T6 (janela do `is_short`, órfãos), T1 (etapas e trava), T6b (piso 60), Emendas (E9) |
| Yannis C1 (sem `EngineCtx`) | T6 |
| Yannis C4 (`dispensa_motivo`, `dispensado_por`) | T4 |
| Yannis C6 (prazo real da pesada) | T7, conferências D+30/D+90, T1 passo 4 |
| Yannis M1 | T1 (`server-only`, heap) |
| Yannis M2, M3, M4, M5 | T2, T4, T4, T6 |
| Yannis M6 | T9 |
| Yannis M7, M8 | T5, T3 |
| Yannis M9, M10 | T4 (teto de `evidence`), T8 (teste de tamanho), T7 (2 sites) |

**Mecanismo único de sino, resumo e expiração (decidido na r2).** (1) `public.niche_signals_expirar(p_site uuid) returns int`: marca `expirado` onde `aberto and expires_at <= now()` e expira em `notifications` (`expired_at = now()`, sempre com `site_id = p_site`) a notificação individual (`dedup_key = 'nicho:' || id`) e todo resumo cujos ids de `payload->'ids'` já não estão `aberto`. Chamada em dois lugares: início de `niche_signals_gravar` e início de `enviarAvisosDoNicho` (que roda todo dia, **sem** `ligaCom`), de modo que o sino cai mesmo com o gravador parado. `niche_signals_dispensar` usa o mesmo `update notifications`. (2) Resumo: `dedup_key = 'nicho-resumo:' || dia_sp || ':' || left(sha256(ids ordenados), 12)`; o mesmo conjunto repetido gera uma notificação, conjunto diferente gera outra. (3) Baseline do outbox: na 1ª execução do outbox num site (nenhuma notificação `youtube.niche_signal` do site em `notifications`), **todo** pendente `aberto` (qualquer `first_seen_at`, qualquer `notificar_como`) vai num único resumo "N sugestões do nicho em aberto" (sem "novas"), e as linhas ficam `notificar_como = 'resumo'`; os resumos seguintes usam "N sugestões do nicho". (4) Falha: 3 tentativas → `notificacao_falhou_em`; a tarefa devolve em `extra.acao` (canal de `executar.ts:350` → `acao_do_dono`) "N sugestões do nicho não chegaram ao sino" por 7 dias (só número).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** gravar 1×/dia, por site, os sinais do nicho ("destino esquentou" em `pais:` e "vídeo parecido bombou") numa tabela única, notificar pelo sino por outbox e entregar a lista ao Cowork e ao Claude Code (rota + ação MCP) com o mesmo N.

**Architecture:** núcleo puro (`lib/youtube/observatorio/sinais/`) recebe uma projeção estreita (outliers já filtrados pela régua D6, vídeos próprios com lugar, `agora`) e devolve oportunidades ou `motivoVazio`; o lugar v0 é determinístico (`lib/youtube/observatorio/lugar/`), semeado de um JSON único que gera a migration e alimenta os testes. A borda (`sinais/gravador.ts`) monta o observatório pelo motor existente, recalcula `video_lugares` só onde o texto mudou e grava tudo numa chamada atômica `niche_signals_gravar` (que também grava `niche_outliers_vistos`, a memória de 14 d do núcleo). Leitura só da tabela (`sinais/leitura.ts`), usada pela rota, pela ação MCP do Cowork, pela ação `sugestoes` da chave pessoal do Claude Code e (na F3) pela tela.

**Tech Stack:** Next.js 16, Supabase (Postgres 17, plpgsql, RLS), Vitest, Zod, agenda do A5.

**Spec:** `docs/superpowers/specs/2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md` (r14+, mais as "Emendas ao spec" deste plano): linha "F2 Sinal via Cowork" da §7, §2.4 T2/T3, §3.1–3.5, §3.7, §4, §8. Código de referência: `origin/main` b75595690 (A5 já promovida em 21/10).

## Global Constraints

- Migration só por `npm run db:new <nome>`; idempotente (`create ... if not exists`, `drop policy if exists` antes de `create policy`, `create or replace function`); `set lock_timeout = '5s'` no topo. Migration antes do código que grava (§7).
- Funções novas: `plpgsql`, `security invoker`, `set search_path = ''`, `revoke all ... from public, anon, authenticated; grant execute ... to service_role` (molde `yt_watch_reter`). Nunca chamar função sem EXECUTE no banco local (SIGSEGV): conferir com `has_function_privilege`.
- RLS: `niche_signals`, `niche_signals_estado`, `video_lugares` com leitura `public.can_edit_site(site_id)` (leitura sensível, nunca `site_visible`); `insert/update/delete` só `service_role`. `lugares`/`lugar_aliases` sem `site_id`: RLS ligada sem policy (só serviço). Teste que falsifica o GUC `app.site_id` como não-superusuário.
- Régua única (D6): `obs.outliers({ maxAge: 30, fmt })` com `!weak && phase.id === 'estourando'`, rodada para `fmt = 'long'` e `fmt = 'short'`. Nenhuma régua paralela.
- **D20:** nenhuma coluna de desempenho do vídeo próprio (views, CTR, nota, `vpd7`) entra na entrada da força, da ordenação ou de filtro de "destino esquentou" e "parecido". Garantido por tipo (`EntradaDaForca` não tem o campo) e por teste.
- Força, ordenação e texto: "pode ajudar", nunca "vai ajudar" (D2). Ordem pela `forca` (D15).
- Regra versionada: `REGRA_SINAIS.versao = 1`; `rule_version = 'sinais-v' + versao + '+semente-' + semente_versao`. Parâmetros: `janelaDias 14`, `minOutliers 2`, `minCanais 2`, `nMinimo 8` (**PROVISÓRIO**: vídeos `tracked` com `vpd7` no formato, exatamente o conjunto de `median7`; Phil fixa com a medida da T1), `multSozinho = RULES.tiers.high` (**PROVISÓRIO**, hoje 5, reaproveitado de `rules.ts`, sem constante paralela; a T1 imprime a distribuição que o calibra), `pisoViews 2000` (`vpd7 × 7` do mesmo `ObsVideo`), `validadeDias 30`, `carenciaDispensaDias 30`, `topParecidos 3`, `jaccardMin 0.3` (**PROVISÓRIO, sem medida**: Jaccard sobre título + tags, a descrição só entra no lugar; fixado pelo controlador na T1 passo 4), `parecidoNotificaIndividual false` (o `parecido` nasce sempre `notificar_como = 'resumo'` até a rotulagem da T1 passo 4 fixar `jaccardMin`; ele aparece na lista do Cowork), `tetoNotificacoesDia 5`, `tetoTentativas 3`, `tetoEvidenciaOutliers 20`. **`mult` = `vpd7 / median7(canal, formato)`**, a grandeza da régua D6 (não o `mult` de tela de `multiplier.ts`); os dois vão em `evidence`.
- Notificação: `fanOutToSiteAdminsDetailed`, `domain: 'youtube'`, `type: 'youtube.niche_signal'`, `dedup_key 'nicho:' || id` e `'nicho-resumo:' || dia_sp || ':' || left(sha256(ids),12)`, `defaultChannels: []` (só sino; nunca `channels` nem override), payload só ids, `action_href` `/cms/youtube/competitors?aba=sugestoes` (a página ignora o parâmetro até a F3; a lista existe pelo Cowork). Resumo com `dedup_key` conforme o "Mecanismo único" acima. Sem migration de CHECK, sem mexer em `NotificationType`, no leitor do sino nem em `expire-notifications`.
- Flag `OBS_SINAIS_NICHO` (`ligaCom`): só o valor exato `on` liga `sinais_do_nicho`; ausente = desligada. `avisos_pendentes` **não** tem `ligaCom`. Variável no Vercel **antes** do deploy que a lê.
- Pipeline Integrity em toda rota nova: `api-registry.ts` (entrada + `endpoint_count` do domínio youtube 36 → 38), `apps/web/data/pipeline-docs/cowork-docs-youtube.md`, `docs/cowork-pipeline-reference.md` e reexecutar o seed da referência (memória). Nunca criar ou revogar chave.
- Paridade Cowork × Claude Code: o Cowork chega por `youtube_observatory` (ação `get_signals`) e pela rota; o Claude Code chega pela chave pessoal do perfil `observatorio_leitura` (ação só de leitura `sugestoes`; a chave pessoal nunca escreve, o dispensar fica no Cowork). Os três chamam a mesma `listarSinaisDoNicho`; um teste afirma JSON idêntico nos três (as ações `destaques`, `serie` e `mudancas` já existem lá sem tela própria; a F3 só acrescenta o pacote da tela).
- LGPD (D5): payload, `evidence` e resposta do Cowork só com ids, números e chaves de lugar; nunca texto de comentário, autor ou imagem (D8).
- Envio: ≤ 3 pushes/dia/terminal até 27/10, combinados com a promoção; `--no-verify` só para docs ou hook falhando em arquivo de outro terminal. Nunca stash/reset. Passo do dono sempre `bash <arquivo>.sh`.
- Prazo da tarefa pesada: nunca constante; `prazoMs = PESADA_FIM_MS − (agora − t0)` (orçamento real ≤ 165 s no pior caso, `comecaAteMs 120_000`).
- Sem `any`; Zod em toda entrada de rota e ação MCP; kebab-case.

## Review Focus

1. **Outlier sem lugar, canal `sem-ritmo` ou canal abaixo de `nMinimo`** (falha em verde): a lista vazia tem de dizer por quê. Esperado: `niche_signals_estado.motivo_vazio` em `sem-terceiro-outlier | sem-lugar | sync-atrasado | sem-historico` e `contagens` com `outliers_sem_lugar`, `canais_sem_ritmo`, `canais_sem_n_minimo`; a leitura devolve isso (e `tudo-respondido` quando havia sinais e todos foram dispensados, feitos ou expirados), nunca `[]` mudo. Testes na T5 e T8.
2. **Gravador parado** (deploy quebrado, flag desligada depois de ligada): o N do Cowork e do sino não pode sobreviver. Esperado: leitura filtra `expires_at > now()`, devolve `desatualizado: true` com `computed_at` há > 36 h; sino cai porque o dispensar e `niche_signals_expirar` marcam `notifications.expired_at`, e `niche_signals_expirar` roda também no outbox (sem `ligaCom`). Teste "relógio + 31 dias sem gravador" na T4, T8 e T9 (flag apagada, linha vencida, contagem do sino cai 1).
3. **Alias ambíguo e localização padrão do canal** ("Georgia", "Natal", "Turkey"; 10 vídeos na mesma coordenada): falso destino dispararia notificação. Esperado: ambíguo só com segundo sinal; `locationDescription` ignorada quando o par (canal, coordenada a 0,1°) tem ≥ 5 vídeos. Testes na T3; portão de precisão ≥ 90% na T10 antes de ligar a flag.
4. **Corrida e reexecução** (dois disparos, dispensar entre execuções): evento duplicado ou dispensado reaberto. Esperado: índice único parcial + função atômica; dispensado fica dispensado por 30 dias. Testes de integração na T4.
5. **Primeira execução com dezenas de eventos** (o dono recebe 40 sinos): Esperado: linha de base marcada `notificar_como = 'resumo'` e **uma** notificação-resumo; depois teto de 5/dia e o resto no resumo do dia. Testes na T9.

## Falha em verde: o que cada gravação faz quando o dado não existe

| Gravação | Dado ausente | Comportamento |
|---|---|---|
| `video_lugares` | vídeo sem texto ou sem alias que case | linha gravada com `chaves = '{}'` (medido, sem lugar), contada em `outliers_sem_lugar`; nunca vídeo omitido |
| `niche_signals` | nenhum outlier `estourando` | zero linhas novas **e** `niche_signals_estado.motivo_vazio = 'sem-terceiro-outlier'` com `computed_at` |
| `niche_signals` | outliers existem mas todos sem lugar | `motivo_vazio = 'sem-lugar'` |
| `niche_signals` | todos os canais `sem-ritmo` | `motivo_vazio = 'sync-atrasado'` com `canais_sem_ritmo` |
| `niche_signals` | site sem vídeo próprio | destino vira `acao = 'video_novo'`; parecido não nasce; `contagens.proprios = 0` |
| `niche_signals_estado` | cálculo produziu itens, todos dispensados/expirados | leitura devolve `n = 0` com `motivoVazio: 'tudo-respondido'` e `contagens.respondidos_30d`; nunca `null` com `n = 0` |
| `niche_signals_estado` | gravador nunca rodou | leitura devolve `motivoVazio: 'nunca-calculado'` |
| outbox | `total === 0` (sem admin) | erro, conta tentativa; 3 → `notificacao_falhou_em`, tarefa vermelha; depois `acao_do_dono` por 7 dias com a contagem |
| `lugar_aliases` | leitura paginada devolve menos que `count: 'exact'` | tarefa `erro`, motivo `semente_incompleta`; nada gravado |
| tarefa | `loadRows` estoura o prazo | `estado: 'erro'`, motivo `motor_estourou`; nada gravado, `estado` antigo vira `desatualizado` na leitura |

---

### Task 0: Preparação (controlador, sem código)

- [ ] Colar no ledger (`.superpowers/sdd/ab-lab/f2/ledger.md`) `git diff --name-only origin/main...<HEAD de cada worktree ativo da A5 e da F1a>` filtrado por `agenda/definicoes.ts|agenda/catalogo.ts|observatorio/outliers.ts|pipeline/api-registry.ts|cowork-docs-youtube.md|mcp/tools.ts`. Interseção com a F1a-dado: `definicoes.ts` e `catalogo.ts` (T12 dela). **Ordem:** se a T12 da F1a já estiver em `staging`, a T7 daqui rebaseia em cima; se não, as duas entradas são independentes (linhas novas, sem edição de linha alheia) e quem chega depois resolve o conflito trivial. A T9 daqui **exige** a T12 da F1a em `staging` (edita `avisos-pendentes.ts`).
- [ ] Refazer os `git grep` de §3.4 em `origin/main`: `outliers.ts:62` (`fmt: 'long'` padrão), `fan-out-to-admins.ts:73`, `catalogo.ts:30-32`, `relogio.ts` (`PESADA_FIM_MS = 285_000`), `observatorio/index.ts` (a interface `Observatory` não expõe `ctx`), `mcp/observatorio/servidor.ts` e `acesso-ia/acoes.ts` (forma de uma ação de leitura). Divergência → ledger antes de codar.

Estimativa: ~15 mil tokens.

### Task 1: Script de custo do gravador e calibração T3 (só leitura; gate do `peso`)

**Files:**
- Create: `apps/web/scripts/f2-medir-gravador.ts`, `scripts/f2-medir-gravador.sh` (o `.sh` usa o precedente de `observatorio-acesso.ts:2`: `npx tsx --tsconfig apps/web/tsconfig.json --require ./apps/web/scripts/_sem-server-only.cjs --env-file apps/web/.env.local apps/web/scripts/f2-medir-gravador.ts`, porque `load.ts:3` importa `server-only`; o script **recusa** `.insert/.update/.upsert/.delete/.rpc` por um proxy do cliente, pois usa a chave de serviço; saída em `.superpowers/sdd/ab-lab/f2/medida-gravador-<data>.json`)
- Test: `apps/web/test/youtube/observatorio/sinais/medir-gravador.test.ts` (só a função pura de projeção)

**Interfaces:**
- Produces: `export function projetarIdas(linhasDiaria: number, diasAtuais: number, diasAlvo: 90 | 365, linhasPorIda: 1000): number`; o JSON `{ etapas: {loadRows, rowsToDataset, createObservatory, outliersLong, outliersShort, lerVideoLugares, lerLugarAliases, lerDescricaoPropria, lerCompetitorRawRecordingDetails}: {p50, p95}[ms] e heapMB por etapa, idas, linhas, latenciaIda1000Ms, projecao: {d90, d365}: {idas, p95Ms}, t3: { porFormato: {long|short: {canais, canaisComNMinimo8, estourandoPorCanal: Record<string, number>}}, multDistribuicao: {long|short: {p50, p90, max, nAcimaDe5}} (de `vpd7/median7` dos `estourando`, o insumo de `multSozinho`), parecidoAmostra: {top20: {jaccard, tituloTerceiro, tituloProprio}[], histograma em degraus de 0,05} (Jaccard título + tags, outlier × próprio) }`.

- [ ] **Step 1:** teste de `projetarIdas` com os números do spec: 14.814 linhas em 19 dias, alvo 365 → ≈ 285 idas (tolerância ±5). FAIL.
- [ ] **Step 2:** implementar. O script usa `getSupabaseServiceClient()` só com SELECT, chama `loadRows`/`rowsToDataset`/`createObservatory`/`outliers` 5 vezes **sem** `unstable_cache` (chamada direta, não `loadObservatory` do serviço) e cronometra cada etapa; mede uma ida de 1.000 linhas de `competitor_video_daily`; T3 conta, por canal e formato, vídeos `tracked` com `vpd7` (o conjunto de `median7`) e a taxa de `estourando` **pelo motor**. PASS. Teste adicional: o proxy de só leitura lança em `.rpc`/`.upsert`.
- [ ] **Step 3: passo do dono** (leitura de produção negada no modo automático): `bash scripts/f2-medir-gravador.sh`. Resultado no ledger.
- [ ] **Step 4: decisão escrita no ledger:** `peso: 'pesada', cedeA: ['sincronizar_canais']` (padrão), válido só se `projecao.d365.p95Ms + 120_000 <= 285_000 − 60_000` (p95 ≤ 105 s: a pesada pode começar até `comecaAteMs`); `leve` só se `projecao.d365.p95Ms <= 10_000`; acima de 105 s o plano volta ao Yannis (paginar o motor), o aceite não se afrouxa. Se `canaisComNMinimo8` < metade dos canais em `long`, Phil fixa `nMinimo`. Phil fixa `multSozinho` olhando `multDistribuicao`. O controlador rotula os 10 primeiros pares de `parecidoAmostra` e fixa `jaccardMin` no menor degrau em que ≥ 8 dos 10 fazem sentido; até lá o `parecido` fica só no resumo. Os valores vão a `REGRA_SINAIS` antes de qualquer gravação em produção.

**Aceite:** JSON no ledger com p95 por etapa e projeção a 365 d; decisão de peso, `nMinimo`, `multSozinho` e `jaccardMin` escrita (ou marcada provisória com o motivo). Estimativa: ~60 mil tokens.

### Task 2: Migration A — `lugares`, `lugar_aliases`, `video_lugares` e semente

**Files:**
- Create: `apps/web/data/lugares/semente-v1.json` (fonte única: `{ versao: 1, lugares: [{slug, pais_iso2, nivel: 'pais'|'local', aliases: [{alias, ambiguo}]}] }`; ~250 países em pt, en e nome local, mais ~100 destinos do nicho de viagem, incluindo os do teste da T3; `ambiguo: true` em Natal, Porto, Lima, Cuba, Salvador, Belém, Vitória, Georgia, Jordan, Chad, Turkey)
- Create: `apps/web/scripts/gerar-semente-lugares.ts` (lê o JSON, aplica `normalizarLugar` da T3, recusa alias normalizado repetido entre slugs, imprime o SQL `insert ... on conflict (alias_norm) do update set slug, ambiguo, semente_versao`)
- Create: migration por `npm run db:new f2_lugares` (tabelas + RLS) e, colado do script, o bloco de semente no mesmo arquivo
- Test: `apps/web/test/integration/f2-lugares-rls.test.ts`, `apps/web/test/youtube/observatorio/lugar/semente.test.ts`

**Interfaces:**
- Produces (schema): `lugares(slug text primary key, pais_iso2 char(2) not null, nivel text not null check (nivel in ('pais','local')))`; `lugar_aliases(alias_norm text primary key, slug text not null references lugares on delete cascade, ambiguo boolean not null default false, semente_versao smallint not null)`; `video_lugares(video_id uuid primary key (sem FK: serve aos dois donos; órfãos podados pela T6), site_id uuid not null references sites on delete cascade, origem text not null check (origem in ('competidor','proprio')), chaves text[] not null, fonte text not null check (fonte in ('texto','texto+coordenada')), entrada_hash text not null, semente_versao smallint not null, computado_em timestamptz not null)`, índice `(site_id, origem)` e GIN em `chaves`. Slugs: `pais:VN`, `local:vn-phu-quoc`.

- [ ] **Step 1:** testes: **deriva**: o gerador regenera o SQL a partir do JSON e o teste o compara com o bloco colado na migration (falha se editada à mão); o gerador da semente v2 emite `delete from lugar_aliases where alias_norm not in (...)` antes do upsert (teste v1→v2 removendo um alias); semente sem alias normalizado duplicado; todo `local:` tem `pais_iso2` com `pais:` correspondente; os 11 ambíguos marcados; "Turquia"/"Türkiye" não ambíguos e apontando para `pais:TR`. Integração: `authenticated` sem `can_edit_site` lê 0 linhas de `video_lugares` mesmo com `app.site_id` falsificado; `authenticated` não lê `lugar_aliases`; `insert` por `authenticated` recusado. FAIL.
- [ ] **Step 2:** JSON, script (depende de `normalizarLugar`: fazer a T3 Step 3 antes deste passo ou na mesma sessão), migration. `npm run db:reset` no banco 54421. PASS.
- [ ] **Step 3:** commit (`feat: F2 tabelas de lugar e semente v1`).

**Aceite:** testes verdes; `select count(*) from lugar_aliases` igual ao total de aliases do JSON no banco local (esperado ~1.050, acima do teto de 1.000 linhas por requisição do PostgREST; por isso a leitura é paginada, T6). O índice em tempo de execução vem do **banco** (`versao = max(semente_versao)`), não do JSON empacotado, para o deploy antes do `db:push` não divergir. `db:push:prod` só no envio F2-1, depois da revisão de Phil e Yannis. Estimativa: ~90 mil tokens.

### Task 3: Lugar v0 — `normalizarLugar`, índice de n-gramas e extração

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/lugar/normalizar.ts`, `.../lugar/casar.ts`, `.../lugar/coordenada.ts`
- Test: `apps/web/test/youtube/observatorio/lugar/casar.test.ts` (`// @vitest-environment node`; usa `data/lugares/semente-v1.json` de verdade)

**Interfaces:**
- Produces: `export function normalizarLugar(s: string): string` (NFD sem marcas + dobra `đ→d, ł→l, ø→o, ı→i, æ→ae, œ→oe, ß→ss`, minúsculas, pontuação → espaço, espaços colapsados); `export interface IndiceDeLugar { porAlias: Map<string, { slug: string; ambiguo: boolean; pais: string }>; nMax: number; versao: number }`; `export function montarIndice(aliases: ReadonlyArray<{alias_norm: string; slug: string; ambiguo: boolean; pais_iso2: string}>, versao: number): IndiceDeLugar`; `export interface EntradaDeLugar { titulo: string; tags: readonly string[]; descricaoInicio: string; locationDescription: string | null; coordenadaPadraoDoCanal: boolean }`; `export function extrairLugares(e: EntradaDeLugar, ind: IndiceDeLugar): { chaves: string[]; fonte: 'texto' | 'texto+coordenada' }` (até 3 chaves, ordenadas pela posição no título, depois tags, descrição; cada `local:` também emite o seu `pais:`, e o teto de 3 conta só `pais:`); `export function entradaHash(e: EntradaDeLugar, versao: number): string` (sha256 hex do JSON normalizado); `export function paresPadrao(videos: ReadonlyArray<{canal: string; lat: number | null; lng: number | null}>): Set<string>` (chave `canal|lat.toFixed(1)|lng.toFixed(1)` com ≥ 5 vídeos). `descricaoInicio` = primeiros 300 caracteres.
- Regra do ambíguo: casa só com segundo sinal: outro alias do **mesmo país** em tags ou descrição, ou `locationDescription` (não padrão) casando o mesmo país. A preposição `em|na|no` imediatamente antes vale como segundo sinal só para os ambíguos em pt; para os ambíguos em inglês (Georgia, Jordan, Chad, Turkey) `in|to` **não** basta: exige outro alias do mesmo país (Yannis M8).

- [ ] **Step 1: testes de tabela (§2.4 T2):** casam `Phú Quốc`, `Phu Quoc`, `Đảo Phú Quốc`, `Ilha de Phu Quoc` → `local:vn-phu-quoc` + `pais:VN`; `Vietnã`, `Vietnam`, `Hồ Chí Minh`, `Łódź`, `İstanbul`, `Tromsø`; "Georgia" e "Natal" sozinhos → `[]`; "Turquia" sozinho → `pais:TR`; "Turkey" sozinho → `[]`; "Turkey" + "Istanbul" na descrição → `pais:TR`; "Tailândia, Vietnã e Camboja em 15 dias" → `['pais:TH','pais:VN','pais:KH']` nessa ordem; `locationDescription` com `coordenadaPadraoDoCanal: true` não contribui; canal sintético com 10 vídeos na mesma coordenada → `paresPadrao` contém o par; `entradaHash` estável para a mesma entrada e diferente com `versao` 2; 20 títulos negativos (`"Trip to Georgia"` sem segundo sinal, `"Porto seguro de vida"`, `"Natal em família"`, `"Chad reage"`, `"Lima limão receita"`, …) → `[]`. FAIL.
- [ ] **Step 2:** implementar. Casamento por janela deslizante de n-gramas de tokens (n de `nMax` a 1, o maior vence e consome os tokens): O(T·nMax) por texto, nunca O(aliases·T). PASS.
- [ ] **Step 3:** commit (`feat: F2 lugar v0 determinístico`).

**Aceite:** acima; nenhum import de banco. Estimativa: ~70 mil tokens.

### Task 4: Migration B — `niche_signals`, `niche_signals_estado` e as funções de gravar e dispensar

**Files:**
- Create: migration por `npm run db:new f2_niche_signals`
- Test: `apps/web/test/integration/f2-niche-signals.test.ts`, `apps/web/test/integration/f2-niche-signals-rls.test.ts`

**Interfaces:**
- Produces (schema): `niche_signals(id uuid pk default gen_random_uuid(), site_id uuid not null references sites on delete cascade, kind text not null check (kind in ('destino','parecido')), subject_key text not null, rule_version text not null, evidence jsonb not null, forca numeric(8,2) not null, acao text not null check (acao in ('titulo_descricao','playlist','video_novo','titulo_complementar','thumbnail_ideias')), status text not null default 'aberto' check (status in ('aberto','dispensado','feito','expirado')), first_seen_at timestamptz not null, computed_at timestamptz not null, expires_at timestamptz not null, adiado_ate timestamptz, dispensado_em timestamptz, motivo text not null, notificar_como text not null default 'individual' check (notificar_como in ('individual','resumo')), notificado_em timestamptz, notificacao_tentativas smallint not null default 0, notificacao_falhou_em timestamptz, dispensa_motivo text check (dispensa_motivo in ('nao_e_parecido','lugar_errado','ja_fiz','nao_interessa')), dispensado_por text)` (`motivo` é a explicação do sinal e nunca é sobrescrito pelo dispensar; `dispensa_motivo` e `dispensado_por`, `user:<uuid>` ou id da chave MCP, só pela função); índice único parcial `(site_id, kind, subject_key) where status = 'aberto'`; índice `(site_id, status, expires_at)`; índice parcial `(site_id) where notificado_em is null and notificacao_falhou_em is null and status = 'aberto'`. `kind` já aceita só os dois da F2; "meu vídeo caiu" (F4) estende o CHECK.
- `niche_outliers_vistos(site_id uuid not null references sites on delete cascade, video_id uuid not null, canal_id uuid not null, formato text not null, published_at timestamptz not null, n_canal int not null, primeiro_visto_em timestamptz not null, ultimo_visto_em timestamptz not null, mult_max numeric(8,2) not null, vpd7_max numeric not null, chaves text[] not null, primary key (site_id, video_id))`: memória dos outliers `estourando` já vistos (upsert com `least/greatest`), lida pelo núcleo com `ultimo_visto_em >= agora − 14 d`, para a janela de 14 d ser real e não "ao mesmo tempo"; também fonte do `pre_contaminado` da F2b. RLS `can_edit_site`, escrita só `service_role`, sem retenção (< 1 MB/ano).
- `niche_signals_estado(site_id uuid pk references sites on delete cascade, computed_at timestamptz not null, rule_version text not null, motivo_vazio text check (motivo_vazio in ('sem-historico','sem-terceiro-outlier','sem-lugar','sync-atrasado')), contagens jsonb not null)`.
- `evidence` (F2b, §3.6): `{ outliers: [{ video_id, canal_id, published_at, mult_vpd7, mult_tela, vpd7, formato }], outliers_total: n, canais: n, proprios: [video_id...] }`; `published_at` e `canal_id` gravados **na criação** e nunca mais alterados (a função mescla só `forca`, `motivo`, contagens e a lista de outliers **acrescentando** novos, nunca removendo nem mudando os existentes), com teto `tetoEvidenciaOutliers = 20` entradas (os mais fortes na criação; depois só acrescenta até o teto) e `outliers_total` em número.
- `public.niche_signals_expirar(p_site uuid) returns int` (o passo (1) abaixo, isolado: `expirado` onde `aberto and expires_at <= now()` e `update notifications set expired_at = now() where site_id = p_site and domain = 'youtube' and type = 'youtube.niche_signal' and dedup_key = 'nicho:' || id and expired_at is null`; resumo (`dedup_key like 'nicho-resumo:%'`, sempre com `site_id = p_site`) expira quando nenhum id de `payload->'ids'` continua `aberto`); mesmos `revoke/grant` das demais.
- `public.niche_signals_gravar(p_site uuid, p_lote jsonb, p_estado jsonb, p_linha_de_base boolean, p_vistos jsonb) returns jsonb` (`{novos, atualizados, expirados}`), numa transação: (1) `perform niche_signals_expirar(p_site)`; (2) `insert ... on conflict (site_id, kind, subject_key) where status = 'aberto' do nothing`, pulando chave com `dispensado` e `dispensado_em > now() - interval '30 days'`; com `p_linha_de_base` grava `notificar_como = 'resumo'`; `expires_at = first_seen_at + 30 d` (validade fixa); o evento novo só nasce se o lote o traz (o núcleo já filtrou pelas âncoras, abaixo); (3) `update` de `evidence`, `forca`, `motivo`, `rule_version`, `computed_at` só em `aberto`, nunca `status`/`dispensado_*`/`dispensa_*`/`expires_at`; `atualizados` não conta as linhas inseridas no passo (2) da mesma chamada; (4) upsert de `niche_outliers_vistos` (`p_vistos`) e de `niche_signals_estado`.
- `public.niche_signals_dispensar(p_site uuid, p_id uuid, p_status text, p_motivo text, p_por text) returns jsonb` (`p_status in ('dispensado','feito')`; `p_motivo` no enum de `dispensa_motivo` (nulo aceito em `feito`); grava `dispensa_motivo` e `dispensado_por`, nunca `motivo`; só de `aberto`; `{ok: true}` ou `{ok: false, motivo: 'nao_encontrado'|'nao_aberto'|'motivo_invalido'}`; mesmo `update notifications` do passo 1, com `site_id = p_site`).
- **Âncoras (Phil 5):** a borda lê `ancorasPorChave: Map<subject_key, Set<video_id>>` de `evidence.outliers` de todo evento da mesma chave com `first_seen_at > now() − 60 d` em qualquer status; o núcleo (T5) só abre evento **novo** com outliers que não estão em nenhum conjunto de âncoras; chave com evento `aberto` usa todos os outliers só para atualizar `evidence`/`forca`.

- [ ] **Step 1: testes (banco 54421, `describe.skipIf(skipIfNoLocalDb())`):** duas chamadas concorrentes com o mesmo lote → 1 linha; falha injetada no passo 3 (lote com `forca` inválida) desfaz 1 e 2; dispensar → regravar → continua `dispensado` e nada novo; carência 29 d bloqueia, 31 d cria (relógio por `update dispensado_em`); `evidence.outliers[0].published_at` não muda depois de um 2º lote com outro valor; `evidence.outliers` nunca passa de 20 e `outliers_total` conta tudo; dispensar com `p_motivo` mantém `motivo` igual e preenche `dispensa_motivo`/`dispensado_por`; `p_motivo` fora do enum → `motivo_invalido`; `niche_signals_expirar` no site A não expira o resumo do site B; "feito" seguido de regravação com os mesmos outliers não cria evento (âncora); **dispensar derruba o que `/api/notifications/count` lê** (consulta idêntica à da rota: `dismissed_at`, `expired_at`, `read_at` nulos); linha com `expires_at` passado + nova chamada → `expirado` e notificação expirada (o "gravador parado por 31 dias" visto na 1ª execução seguinte; a leitura já o esconde antes, T8); `has_function_privilege('authenticated', ..., 'execute') = false`; RLS: não-membro com GUC falsificado lê 0 linhas de `niche_signals` e `niche_signals_estado`. FAIL.
- [ ] **Step 2:** migration. PASS. **Step 3:** commit (`feat: F2 niche_signals e gravação atômica`).

**Aceite:** acima. `db:push:prod` das migrations A e B depois da revisão de Phil e Yannis da T2 e da T4 (envio F2-1). Estimativa: ~140 mil tokens.

### Task 5: Núcleo puro `oportunidades.ts`

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/regra.ts` (`REGRA_SINAIS`), `.../sinais/oportunidades.ts`, `.../sinais/tokens.ts`
- Test: `apps/web/test/youtube/observatorio/sinais/oportunidades.test.ts` (literais, sem `createObservatory`)

**Interfaces:**
- Consumes: chaves de `extrairLugares` (T3).
- Produces:
  - `export interface OutlierProjetado { videoId: string; canalId: string; formato: 'long' | 'short'; publishedAt: string; mult: number /* vpd7 / median7 */; multTela: number /* item.mult.value, só evidência */; vpd7: number; nCanal: number; chaves: string[]; tokens: string[] }`
  - `export interface ProprioProjetado { videoId: string; formato: 'long' | 'short' | null; chaves: string[]; tokens: string[] }` — **sem** views/CTR/nota (D20); a borda exclui vídeo `private` ou `is_hidden` (disponibilidade, não desempenho; testado)
  - `export interface EntradaDoNucleo { outliers: OutlierProjetado[] /* os de hoje mais os de niche_outliers_vistos dos últimos 14 d, sem repetir videoId */; ancorasPorChave: ReadonlyMap<string, ReadonlySet<string>>; chavesAbertas: ReadonlySet<string>; proprios: ProprioProjetado[]; canaisSemRitmo: number; canaisTotal: number; outliersSemLugar: number; agora: Date; semente: number }`
  - `export interface Oportunidade { kind: 'destino' | 'parecido'; notificarComo: 'individual' | 'resumo'; subjectKey: string; acao: 'titulo_descricao' | 'video_novo' | 'playlist'; forca: number; motivo: string; evidence: Evidence; alvos: string[] }`
  - `export type MotivoVazio = 'sem-historico' | 'sem-terceiro-outlier' | 'sem-lugar' | 'sync-atrasado'` (a leitura da T8 acrescenta `'tudo-respondido'` e `'nunca-calculado'`)
  - `export function calcularOportunidades(e: EntradaDoNucleo): { itens: Oportunidade[]; motivoVazio: MotivoVazio | null; contagens: Record<string, number> }`
  - `export type EntradaDaForca = { mults: number[]; canais: number; idadeDias: number }`; `export function forcaDe(f: EntradaDaForca): number` = `round2(Σ log2(mult) × (1 + 0.5 × (canais − 1)) × max(0.2, 1 − idadeDias / 30))`, `idadeDias` contada do `publishedAt` mais recente da evidência.
  - `export function tokensDe(texto: string): string[]` (`normalizarLugar` + stopwords pt/en fixas em `tokens.ts`, tokens ≥ 3 letras, únicos).
- Regras (§3.1, §3.2, §4): outlier entra só com `nCanal >= nMinimo` e `vpd7 × 7 >= pisoViews` (senão conta `sem_n_minimo`/`abaixo_do_piso`); **destino** por chave `pais:` com (≥ 2 outliers de ≥ 2 canais na janela de 14 d por `publishedAt`, contando os vistos nos últimos 14 d) **ou** (1 outlier com `mult >= multSozinho`); evento novo só com outliers fora de `ancorasPorChave[chave]`; chave em `chavesAbertas` atualiza com todos; `notificarComo = 'individual'`; `acao = 'titulo_descricao'` com `alvos` = próprios com a chave (ordenados por id, nunca por desempenho), `'video_novo'` sem próprio; **parecido** (`notificarComo = 'resumo'` enquanto `parecidoNotificaIndividual = false`; só outliers de **hoje**) por outlier com `jaccard(tokens) >= jaccardMin` (Jaccard por `Set`, O(T), nunca `includes` em laço; tokens de título + tags) e mesmo formato (próprio com `formato: null` passa e o motivo diz "formato não confirmado"), até `topParecidos` alvos por Jaccard; frase "mesmo lugar e mesmo tema" quando também divide chave, "tema parecido, lugar diferente" quando não. `motivo` cita os números, `REGRA_SINAIS.versao`, a semente, que `mult` é `vpd7 / mediana dos vídeos do canal no formato` (não o multiplicador de tela) e "piso: vpd7 × 7 do próprio vídeo do terceiro"; texto "pode ajudar". `motivoVazio` só com `itens` vazio, na ordem: `canaisTotal = 0` → `sem-historico`; `canaisSemRitmo = canaisTotal` → `sync-atrasado`; zero outliers → `sem-terceiro-outlier`; todos os outliers sem chave → `sem-lugar`.

- [ ] **Step 1: testes:** um outlier `pais:VN` visto há 5 dias (em `vistos`) mais um de outro canal hoje → destino; dia 30 com A e B ainda `estourando` e ambos âncora → nenhum evento novo, e um C novo com `mult >= 5` → evento novo; próprio `private` fora de `alvos`; 2 outliers `pais:VN` de 2 canais → 1 destino com `alvos` = próprios VN; 2 outliers do **mesmo** canal → nenhum (Phil A3); 1 outlier `mult 6` → destino; 1 outlier `mult 4` → nenhum; outlier com `nCanal 7` → nenhum e `contagens.sem_n_minimo = 1`; `vpd7 × 7 = 1999` → nenhum; sem próprio → `acao 'video_novo'`; **D20:** mesma entrada com o próprio sendo "o melhor do canal" e "o pior" produz `itens` deep-equal (o tipo não tem o campo: `expectTypeOf<ProprioProjetado>().not.toHaveProperty('views')` e idem `ctr`, `vpd7`, `nota`; `expectTypeOf<EntradaDaForca>()` só com `mults`, `canais`, `idadeDias`); parecido com Jaccard 0.29 → nenhum, 0.31 → um, com `notificarComo = 'resumo'`; Short do terceiro não casa próprio `long`; `forcaDe({mults:[4,4], canais:2, idadeDias:0}) = 6`; os quatro `motivoVazio` com histórico apagado (`canaisTotal 0`, todos sem ritmo, zero outliers, todos sem chave); `motivo` contém `v1` e o número de canais; nada de `[]` com `motivoVazio` nulo. FAIL.
- [ ] **Step 2:** implementar. PASS. **Step 3:** commit (`feat: F2 núcleo dos sinais do nicho`).

**Aceite:** acima; o arquivo não importa banco nem `EngineCtx`. Estimativa: ~110 mil tokens.

### Task 6: Borda — projeção a partir do motor e `video_lugares`

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/projecao.ts`, `.../sinais/lugares-do-site.ts`
- Test: `apps/web/test/youtube/observatorio/sinais/projecao.test.ts`, `apps/web/test/youtube/observatorio/sinais/lugares-do-site.test.ts`

**Interfaces:**
- Consumes: `loadRows`, `rowsToDataset`, `createObservatory` (`observatorio/load.ts`, `index.ts`), T3, T5. Não usa `median7` nem `EngineCtx` (o `Observatory` não o expõe, `index.ts:86-110`).
- Produces:
  - `export function projetarOutliers(obs: Observatory, lugarDe: (videoId: string) => string[], textoDe: (videoId: string) => string): { outliers: OutlierProjetado[]; canaisSemRitmo: number; canaisTotal: number; outliersSemLugar: number }` — chama `obs.outliers({ maxAge: 30, fmt })` para `long` e `short`, filtra `!weak && phase.id === 'estourando'`; uma vez, em O(V), monta `nBase: Map<'canal|fmt', {n, m7}>` percorrendo `obs.videos` com o mesmo filtro de `median7` (`tracked && fmt === f && vpd7 != null`; `m7` = mediana desses `vpd7`); `nCanal = nBase.n`, `mult = vpd7 / m7`, `multTela = item.mult.value`; `canaisSemRitmo` por `obs.channels` + `obs.phaseOf` (`sem-ritmo`).
  - `export async function sincronizarLugares(sb: SupabaseClient, siteId: string, rows: ObservatoryRows, proprios: ProprioRow[], indice: IndiceDeLugar, agora: Date): Promise<{ lugarDe: (videoId: string) => string[]; regravados: number; inalterados: number }>` — lê `video_lugares` do site, recalcula em memória (O(V·T)) e faz upsert **só** onde `entrada_hash` ou `semente_versao` mudou. Texto do competidor: de `rows.versions` (`is_current`, **campo `'desc'`**, não `'description'`, tipo `VersionField` de `competitor-versions.ts`; o `loadRows` já leu, sem ida nova) `title` e `desc` + `competitor_videos.tags`; `locationDescription` e coordenada por `competitor_raw` com `readAll` paginado, `.eq('site_id', siteId).eq('is_current', true)` e `select('video_id, rd:raw->recordingDetails')` (nunca o `raw` inteiro); próprio: `youtube_videos.title/description/tags` (leitura própria da descrição; `OWN_VIDEO_COLS` não a traz; sem coordenada). Índice de lugar: `lugar_aliases join lugares` por `readAll` (`load.ts:482`) com `.order('alias_norm')` e `versao = max(semente_versao)`; o número lido tem de igualar `count: 'exact'`, senão `semente_incompleta` (nada gravado). Upsert em blocos de 500; **poda de órfãos**: apaga `video_lugares` do site cujo `video_id` não está no conjunto lido.
  - `export interface ProprioRow { id: string; title: string; description: string | null; tags: string[]; is_short: boolean | null }` (formato pela linha mais nova por vídeo de `yt_own_video_meta_daily` com `day_pt >= hoje_sp − 7`, escolhida em memória; sem linha nesses dias fica nulo; nunca o histórico inteiro).

- [ ] **Step 1: testes** com `ObservatoryRows` sintético (fábrica existente dos testes de `outliers.test.ts`): o mesmo vídeo `estourando` aparece na projeção e em `obs.outliers()` da tela (paridade com o motor); `weak` fora; Short entra só na rodada `short`; segunda chamada de `sincronizarLugares` sem mudança → `regravados 0` e nenhum upsert (spy no cliente); título alterado → só aquele vídeo regravado; semente 2 → todos regravados; `select` de `competitor_raw` nunca pede `raw` inteiro (afirmar a string do select); `nBase.get(ch|fmt)` = tamanho do conjunto que `median7` usa no mesmo dataset; vídeo com `vpd7 = 3 × m7` e `item.mult.value = 1,5` → `mult = 3`, `multTela = 1,5`; fixture com versão `desc` "Istanbul" e título "Turkey" → `pais:TR`; 1.050 aliases semeados no 54421 → índice com 1.050 (leitura que devolve 1.000 → `semente_incompleta`); vídeo órfão podado. FAIL.
- [ ] **Step 2:** implementar. PASS. **Step 3:** commit.

**Aceite:** acima. Estimativa: ~110 mil tokens.

### Task 6b: Portão de precisão do lugar (sobe da T10; roda em paralelo com a T7 e a T8)

**Files:**
- Create: `apps/web/scripts/f2-amostra-lugar.ts`, `scripts/f2-amostra-lugar.sh` (só SELECT, mesmo proxy de só leitura e mesmo `--require ./apps/web/scripts/_sem-server-only.cjs` da T1; reaproveita T3 e T6 sem gravar; saída `.superpowers/sdd/ab-lab/f2/amostra-lugar-<data>.csv` com `video_id, canal, formato, titulo, chaves_calculadas, fonte`)

- [ ] **Step 1:** o script sorteia (semente fixa) 100 outliers de terceiros (todas as fases, 90 d, long e short) **mais** os 20 títulos negativos da T3, e **completa o sorteio** até haver ≥ 60 chaves calculadas. Passo do dono: `bash scripts/f2-amostra-lugar.sh`.
- [ ] **Step 2:** o controlador rotula a coluna `chaves_corretas` (o país do assunto do vídeo); precisão = chaves calculadas corretas ÷ chaves calculadas ≥ **0,90** sobre ≥ 60 chaves (com menos, o intervalo é de ±8 pp a 95%); cobertura por formato (long/short) anotada, sem portão. Abaixo de 0,90: corrigir semente/ambíguos (nova `semente_versao`, com o `delete` da v2), repetir; a flag não liga e o F2-2 não sobe.

**Aceite:** precisão ≥ 0,90 no ledger antes do push F2-2 e de `OBS_SINAIS_NICHO=on`. Estimativa: ~50 mil tokens.

### Task 7: Tarefa `sinais_do_nicho` na agenda (+ flag e doc)

**Files:**
- Modify: `apps/web/src/lib/youtube/agenda/definicoes.ts` (nova `DEFINICAO_SINAIS_DO_NICHO`, entra em `TODAS_AS_DEFINICOES`)
- Modify: `apps/web/src/lib/youtube/agenda/catalogo.ts` (uma importação, uma entrada)
- Create: `apps/web/src/lib/youtube/agenda/tarefas/sinais-do-nicho.ts`, `apps/web/src/lib/youtube/observatorio/sinais/gravador.ts`
- Modify: `docs/ops/env-vars.md` (linha `OBS_SINAIS_NICHO`: `on` liga; ausente/qualquer outro = desligada; liga só depois do portão de precisão da T10; dono: controlador do A/B Lab)
- Test: `apps/web/test/youtube/agenda/catalogo.test.ts` (casos novos), `apps/web/test/youtube/observatorio/sinais/gravador.test.ts`

**Interfaces:**
- Definição: `nome: 'sinais_do_nicho'`, `rotulo: 'sinais do nicho'`, `ordem: 8.5`, `peso: 'pesada'` (ou o que a T1 decidir), `cedeA: ['sincronizar_canais']`, `periodo: 'dia'`, `aPartirDaHoraSP: 7` (depois de `marcas_de_idade` às 4 e da série do dia; antes de `avisos_pendentes` às 9, para a notificação sair no mesmo dia; fora de 12–13, onde moram `serie_semanal` e `retratos_comentarios`), `tetoTentativas: 12`, `toleranciaVigiaH: 36`, `naoTerminouVermelhoEm: null`, `comecaAteMs: 120_000`, `fimAteMs: PESADA_FIM_MS`, `ligaCom: 'OBS_SINAIS_NICHO'`, `motivos: { motor_estourou, gravar_falhou, site_falhou, schema_ausente, inesperado }`.
- `export async function rodarSinaisDoNicho(p: { sb: SupabaseClient; agora: Date; prazoMs: number /* = PESADA_FIM_MS − (c.agora() − c.t0), nunca constante */; inicioMs: number }): Promise<{ sites: number; novos: number; atualizados: number; expirados: number; falhas: number; ms: number }>` — sites = `site_id` distintos de `competitor_channels`; por site, em sequência: `loadRows` (com `comPrazo`), `sincronizarLugares`, `projetarOutliers`, `calcularOportunidades`, `niche_signals_gravar` (com `p_linha_de_base` = site sem nenhuma linha em `niche_signals`, `p_vistos` e as âncoras lidas na borda). Depois de um `motor_estourou`, os sites seguintes conferem o prazo restante antes de começar (o `comPrazo` não cancela o `loadRows` perdedor). Um site que falha conta em `falhas` e não impede o próximo (passos isolados, §3.4); a tarefa fica `erro` com `site_falhou` se `falhas > 0`. Ponto de extensão para a F2b: lista `PASSOS_DEPOIS: Array<(c) => Promise<void>>` vazia, cada passo em `try/catch` próprio.
- `detalhe` (só números): `inicio_ms`, `sites`, `novos`, `atualizados`, `expirados`, `falhas`, `ms`, `outliers`, `outliers_sem_lugar`, `lugares_regravados`.

- [ ] **Step 1: testes:** `catalogo.test.ts`: **variável `OBS_SINAIS_NICHO` apagada** (`delete process.env.OBS_SINAIS_NICHO` com `vi.unstubAllEnvs`) → `sinais_do_nicho` em `desligadas`; `'ON'` e `'1'` → desligada; `'on'` → ligada; definição sem `nuncaDesliga`; gravador: site A lança, site B grava (spy na RPC chamada 1×); com `agora − t0 = 200 s`, `prazoMs` = 85 s e o `comPrazo` de `loadRows` recebe esse valor; 2 sites com `motor_estourou` no 1º → o 2º não começa sem prazo; `loadRows` estoura o prazo → `motor_estourou`, nenhuma RPC; 1ª execução passa `p_linha_de_base = true`, 2ª `false`; nenhum texto de fora em `motivo`/`detalhe`. FAIL.
- [ ] **Step 2:** implementar (molde de `marcas-de-idade.ts`: exceção vira `inesperado`, só classe e SQLSTATE ao Sentry). PASS. **Step 3:** commit.

**Aceite:** acima; `npx vitest run test/youtube/agenda` verde. Estimativa: ~80 mil tokens.

### Task 8: Leitura, rota, ação MCP e Pipeline Integrity

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/leitura.ts`, `apps/web/src/lib/pipeline/services/niche-signals.ts`
- Create: `apps/web/src/app/api/pipeline/youtube/competitors/signals/route.ts` (GET, `authenticateRead`), `apps/web/src/app/api/pipeline/youtube/competitors/signals/[id]/dismiss/route.ts` (POST, `authenticateWrite`)
- Modify: `apps/web/src/lib/pipeline/mcp/tools.ts` (`YoutubeObservatoryShape`: `action` ganha `get_signals` e `dismiss_signal`; parâmetros `signal_id: z.string().uuid().optional()`, `status: z.enum(['dispensado','feito']).optional()`, `motivo: z.enum(['nao_e_parecido','lugar_errado','ja_fiz','nao_interessa']).optional()`)
- Modify: `apps/web/src/lib/pipeline/mcp/observatorio/servidor.ts` (ACOES) e `apps/web/src/lib/pipeline/mcp/observatorio/acesso-ia/acoes.ts` (ação **só de leitura** `sugestoes`, mapeada à tela `/cms/youtube/competitors`, chamando a mesma `listarSinaisDoNicho`; o dispensar não existe para a chave pessoal)
- Modify: `apps/web/src/lib/pipeline/mcp/services/youtube-observatory.ts` (`PARAMETROS_LIDOS` + dois `case`; `dismiss_signal` exige `write` com o mesmo `FORBIDDEN` de `items.ts:34`)
- Modify: `apps/web/src/lib/pipeline/api-registry.ts` (2 entradas; `endpoint_count` youtube 36 → 38), `apps/web/data/pipeline-docs/cowork-docs-youtube.md` (as duas rotas e as duas ações: "pode ajudar", "associação, não causa", `motivoVazio` citado como está, nunca lido como "nada no nicho"), `docs/cowork-pipeline-reference.md` (forma da resposta)
- Test: `apps/web/test/youtube/observatorio/sinais/leitura.test.ts`, `apps/web/test/api/pipeline/competitors-signals.test.ts`, `apps/web/test/mcp/youtube-observatory-parametros.test.ts` (casos novos), `apps/web/test/integration/f2-leitura-paridade.test.ts`

**Interfaces:**
- Produces: `export interface ListaDeSinais { n: number; itens: Array<{ id: string; kind: 'destino' | 'parecido'; subject_key: string; acao: string; forca: number; motivo: string; rule_version: string; evidence: Evidence; first_seen_at: string; expires_at: string }>; computado_em: string | null; desatualizado: boolean; motivoVazio: MotivoVazio | 'nunca-calculado' | 'tudo-respondido' | null; contagens: Record<string, number> }` com a invariante `n = 0 ⇒ motivoVazio != null`: quando `n = 0` e `estado.motivo_vazio` é nulo, devolve `'tudo-respondido'` e `contagens.respondidos_30d` (segunda consulta barata: `count` por `status` com `computed_at > now() − 30 d`); `export async function listarSinaisDoNicho(sb: SupabaseClient, siteId: string, agora: Date, limite = 50): Promise<ListaDeSinais>` — uma consulta `where status = 'aberto' and (adiado_ate is null or adiado_ate <= now) and expires_at > now order by forca desc, first_seen_at` com `count: 'exact'` (N = total, não o tamanho da página) e uma leitura de `niche_signals_estado`; `desatualizado = computado_em < agora − 36 h`. `export async function dispensarSinal(sb, siteId, id, status, motivo, por: string): Promise<{ ok: boolean; motivo?: string }>` (chama `niche_signals_dispensar`; id de outro site → `nao_encontrado`).

- [ ] **Step 1: testes:** linha com `expires_at` passado e `status = 'aberto'` (gravador parado) **não** entra no N; `estado` com `computed_at` de 37 h → `desatualizado: true`; sem `estado` → `'nunca-calculado'`; zero abertos com estado `sem-lugar` → `motivoVazio: 'sem-lugar'` e `contagens.outliers_sem_lugar`; rota GET, `youtube_observatory get_signals` e `observatorio_leitura sugestoes` devolvem JSON deep-equal sobre o mesmo banco (integração, paridade D16); 2 itens gravados e os 2 dispensados → `motivoVazio: 'tudo-respondido'`, nunca `null` com `n = 0`; `get_signals` com 50 itens e `evidence` no máximo cabe em `LIMITE_DO_TEXTO_DA_FERRAMENTA` (60.000); a ação `sugestoes` do `observatorio_leitura` devolve o mesmo `n` e o mesmo JSON (três caminhos); `dismiss_signal` com chave `read` → `FORBIDDEN` e grava `dispensado_por`; `dismiss_signal` derruba o N da próxima `get_signals`; `PARAMETROS_LIDOS` ⇔ `YoutubeObservatoryShape` nos dois sentidos (teste existente, agora com os novos); `api-registry.test.ts` e `registry-completeness.test.ts` verdes com 38; payload sem campo de texto de comentário nem URL de imagem (afirmar chaves de `evidence`). FAIL.
- [ ] **Step 2:** implementar. PASS. **Step 3:** reexecutar o seed da referência do Cowork (memória `reference_cowork_pipeline_schemas`) **no envio**, não antes. **Step 4:** commit.

**Aceite:** acima. Se a ação `sugestoes` passar de ~40 mil tokens ou de um dia, a pergunta vai ao dono (padrão: nasce nos dois caminhos, decisão de paridade de 13/10). Estimativa: ~150 mil tokens.

### Task 9: Outbox do nicho em `avisos_pendentes`

**Pré-requisito:** T12 da F1a-dado em `staging` (Task 0).

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/avisos.ts`
- Modify: `apps/web/src/lib/youtube/agenda/tarefas/avisos-pendentes.ts` (uma chamada a `enviarAvisosDoNicho` depois da parte do nativo, em `try/catch` próprio: falha do nicho deixa a tarefa `erro` com motivo `nicho_falhou` mas não desfaz nem impede o lembrete do dia 14; contadores `nicho_enviados`, `nicho_resumidos`, `nicho_falhas` no `detalhe`; motivo novo no catálogo da definição)
- Test: `apps/web/test/youtube/observatorio/sinais/avisos.test.ts`, `apps/web/test/integration/f2-avisos-sino.test.ts`

**Interfaces:**
- Produces: `export function planejarAvisos(pendentes: ReadonlyArray<{ id: string; forca: number; notificar_como: 'individual' | 'resumo'; notificacao_tentativas: number }>, jaEnviadosHojeIndividual: number, teto: number): { individuais: string[]; resumo: string[] }` (puro: os `teto − jaEnviados` de maior `forca` com `notificar_como = 'individual'` vão um a um; o resto e todos os `resumo` vão no resumo do dia); `export async function enviarAvisosDoNicho(sb: SupabaseClient, agora: Date): Promise<{ enviados: number; resumidos: number; falhas: number }>` — por site com pendentes; começa por `niche_signals_expirar(site)` (roda sem `ligaCom`); a consulta de pendentes filtra `status = 'aberto' and expires_at > now()` explicitamente; baseline e resumo conforme o "Mecanismo único"; `jaEnviadosHojeIndividual` conta `notifications` (`dedup_key like 'nicho:%'`, `created_at >=` início do dia SP), não `notificar_como`; cada envio por `fanOutToSiteAdminsDetailed` (`defaultChannels: []`); marca `notificado_em` **só** se `total > 0 && errors.length === 0` (suprimido por dedup = entregue); senão `notificacao_tentativas + 1` e, ao chegar a 3, `notificacao_falhou_em = now()` e falha contada (vermelho na execução que chega a 3; depois a linha fica fora dos pendentes, sem reenvio). Resumo: `dedup_key 'nicho-resumo:' || dia_sp || ':' || left(sha256(ids ordenados), 12)` (`dia_sp` por `spDate`), `payload { ids }`, título "N sugestões do nicho" (baseline: "N sugestões do nicho em aberto"). A tarefa devolve `extra.acao` com a contagem de linhas com `notificacao_falhou_em > now() − 7 d`.

- [ ] **Step 1: testes:** baseline: 30 pendentes antigos (de qualquer `notificar_como`) → 0 individuais e 1 resumo "em aberto"; no dia seguinte, 1 linha nova → 1 individual; duas passadas no mesmo dia com ids diferentes → duas notificações-resumo visíveis ao sino, a mesma passada repetida → uma; `parecido` nunca entra em `individuais`; sinal dispensado antes da passada → nenhuma notificação; **flag apagada, linha `aberto` com `expires_at` passado e notificação viva → roda `avisos_pendentes` → a consulta de `/api/notifications/count` cai 1**; 3 falhas → vermelho na 3ª, na 4ª `ok` com `acao_do_dono` "1 sugestão do nicho não chegou ao sino", no 8º dia sumiu; `planejarAvisos` com 8 individuais e teto 5 → 5 + 3 no resumo; 2 já enviados hoje → 3 + 5; linha de base (20 `resumo`) → 0 individuais e 1 resumo com 20 ids; **integração lendo o que o sino lê** (consulta de `/api/notifications/count` para o admin semeado): uma sugestão vira +1, dispensar pela T8 vira −1; dono sem `notification_preferences` → nenhuma linha em `notification_deliveries` (nome exato da tabela de entregas conferido no Step 0) fora do sino; `total === 0` → tentativa +1 e falha; falha na 1ª e sucesso na 2ª → 1 notificação (dedup); 3 falhas → `notificacao_falhou_em` e a 4ª execução não tenta; **`OBS_SINAIS_NICHO` apagada → `avisos_pendentes` ligada e a parte do nicho roda (tabela vazia → `nicho_enviados 0`)**; erro forçado no nicho não impede o lembrete do dia 14 (spy). FAIL.
- [ ] **Step 2:** implementar. PASS. **Step 3:** commit.

**Aceite:** acima. Estimativa: ~120 mil tokens.

### Task 10: Revisão final

- [ ] **Step 1: revisão** de Phil (`phil-dados`) e Yannis (`yannis-software`) sobre o diff das T2–T9 (a da T2 e da T4 acontece antes, para o `db:push:prod` do F2-1); consertos até acordo.

**Ordem de execução:** T0, T1, T2, T3, T4, T5, T6, T6b (em paralelo com T7 e T8), T9 (quando a T12 da F1a estiver em `staging`), T10.

**Aceite:** revisões fechadas; portão da T6b no ledger. Estimativa: revisão ~150 mil tokens.

## Envios e calendário

| Envio | Conteúdo | Ordem e condição | Data-alvo | O dono vê |
|---|---|---|---|---|
| **F2-1 (sem build)** | migrations A (T2) e B (T4) | revisão de Phil e Yannis da T2 e da T4; o controlador roda `npm run db:push:prod` (após portão). Os commits das T2–T5 ficam em `staging` e vão no próximo push combinado de qualquer terminal; **nenhum push próprio** | 23–24/10 | nada |
| **F2-2** | T6, T7, T8 (e T9 se a T12 da F1a já estiver em `staging`) | T1 decidida; **portão da T6b ≥ 0,90 no ledger antes do push**; `OBS_SINAIS_NICHO=on` no Vercel antes do deploy. Se o portão não passar, o F2-2 **não sobe** até a semente v2 passar (uma rota que só responde `nunca-calculado` não paga um build), a menos que o push já vá por outra razão | 25–28/10 (não espremer para 27/10) | na manhã seguinte (07:00 SP): perguntar ao Cowork ou ao Claude Code "o que bombou no nicho e eu não tenho?"; cada linha cita os números e a versão da regra; lista vazia diz o porquê; o sino só vem depois |
| **F2-3** | T9 (se não coube no F2-2) | T12 da F1a em produção (envio 1c da F1a, antes de 15/11) | com o envio 1c da F1a | o sino passa a avisar; o primeiro aviso é um resumo do que já está em aberto |

Aceite do F2-1: `select count(*) from lugar_aliases` igual ao total do JSON e as funções (`niche_signals_gravar`, `niche_signals_expirar`, `niche_signals_dispensar`) presentes em produção, conferidas pelo controlador antes do F2-2. Risco registrado (Phil/Yannis): a tarefa é pesada com `cedeA: ['sincronizar_canais']`; se a sincronização a atrasar para depois das 09:00, os sinais do dia só chegam ao sino no dia seguinte (até ~26 h), sem perda; a D0 confere a hora real.

## Conferências datadas (controlador; resultado no ledger)

- **D0** (1ª execução com a flag): `select count(*) from lugar_aliases` = total do JSON; `detalhe.outliers_sem_lugar / detalhe.outliers` anotado (cobertura real); a pergunta ao Cowork e ao Claude Code (chave pessoal) devolve o mesmo `n` da rota; `competitor_agenda_runs` de `sinais_do_nicho` com `status = 'ok'`, `detalhe.sites ≥ 1`; `select kind, count(*), min(rule_version) from niche_signals group by 1`; `niche_signals_estado` com `computed_at` de hoje; **uma** notificação-resumo por admin; `get_signals` pelo Cowork e pela rota com o mesmo `n`.
- **D+1:** linhas novas com `notificar_como = 'individual'` ≤ 5 notificações individuais; `notificacao_falhou_em` nulo em todas; sino e lista coerentes: `select count(*) from notifications n where n.type = 'youtube.niche_signal' and n.dedup_key like 'nicho:%' and n.expired_at is null and n.dismissed_at is null and not exists (select 1 from niche_signals s where 'nicho:' || s.id = n.dedup_key and s.status = 'aberto' and s.expires_at > now())` = 0.
- **D+7:** reexecuções sem duplicata (`select site_id, kind, subject_key, count(*) from niche_signals where status = 'aberto' group by 1,2,3 having count(*) > 1` vazio); `lugares_regravados` perto de 0 nos dias sem vídeo novo; nenhuma resposta de `get_signals` com `n = 0` e `motivoVazio = null`; nenhum outlier repetido entre eventos da mesma chave: `select s.subject_key, o->>'video_id', count(*) from niche_signals s, jsonb_array_elements(s.evidence->'outliers') o group by 1, 2 having count(*) > 1` vazio.
- **D+30:** p95 de `detalhe.inicio_ms + detalhe.ms` de `sinais_do_nicho` em `competitor_agenda_runs` < 225 s (`PESADA_FIM_MS − 60 s`; o orçamento real é `285 s − início`, ≤ 165 s no pior caso); primeiras linhas `expirado` e a consulta da D+1 de novo = 0.
- **D+90:** p95 de novo, com a série diária maior; comparar com a projeção da T1.

## Estimativa total

T0 15 mil · T1 65 mil · T2 90 mil · T3 70 mil · T4 140 mil · T5 110 mil · T6 120 mil · T6b 50 mil · T7 80 mil · T8 150 mil · T9 120 mil · revisões ~150 mil ⇒ **~1,16 milhão de tokens** (Sonnet executa; Opus só na 1ª revisão).

## Fora deste plano

F2b (medida de D2: `niche_signal_efeitos`, janela, C4; a âncora `published_at`/`canal_id` já fica em `evidence` na criação, e `PASSOS_DEPOIS` da T7 é o ponto de entrada); F3 (tela, server action dispensar/feito com `requireSiteAdmin`, chip "candidato" e `getSuggestedVideos` lendo a lista, pacote da tela (a ação `sugestoes` já existe desde a F2)); F4 ("meu vídeo caiu", thumbnail como análise, título complementar, forja propondo aliases, `local:` como chave de evento); dívida de `outliers.ts:30` (`2 *` fixo, `m7` por item; §3.4).; botão dispensar para a chave pessoal (volta quando o dono decidir se a chave pessoal escreve); `acao` `playlist`, `titulo_complementar`, `thumbnail_ideias` sem regra que as produza (ficam no CHECK; F4); `adiado_ate` sem escritor até a F3; a integração só roda com banco local (a CI pula).

## Emendas ao spec (texto exato; o spec não foi editado)

- **E1 (§3.1, tabela `niche_signals`):** acrescentar "colunas `dispensa_motivo` (enum `nao_e_parecido|lugar_errado|ja_fiz|nao_interessa`) e `dispensado_por` (`user:<uuid>` ou id da chave MCP), preenchidas só por `niche_signals_dispensar`; `motivo` é a explicação do sinal e nunca é sobrescrito".
- **E2 (§3.1, janela de 14 d):** substituir "outliers na janela de 14 d" por "outliers vistos como `estourando` nos últimos 14 d, guardados em `niche_outliers_vistos(site_id, video_id, canal_id, formato, published_at, n_canal, primeiro_visto_em, ultimo_visto_em, mult_max, vpd7_max, chaves)`, não só os que estão `estourando` na hora da execução; a mesma tabela alimenta `pre_contaminado` da F2b".
- **E3 (§3.1, validade e reabertura):** acrescentar "um evento novo para (site, kind, subject_key) só nasce com outliers que não constam de `evidence.outliers` de nenhum evento anterior da mesma chave com `first_seen_at` nos últimos 60 dias, em qualquer status (inclusive `feito` e `expirado`)".
- **E4 (§3.1, `mult`):** acrescentar "`mult` da regra é `vpd7 / median7(canal, formato)`, a grandeza da régua D6; `evidence.outliers[]` guarda também `mult_tela` (o `mult` de `multiplier.ts`); `multSozinho = RULES.tiers.high`".
- **E5 (§3.2, parecido):** substituir "parecido notifica" por "`parecido` aparece na lista e só vai ao resumo do sino (nunca individual) até a rotulagem fixar `jaccardMin` (Jaccard sobre título + tags); depois, decisão do dono"; `nMinimo`, `multSozinho` e `jaccardMin` são provisórios até a T1.
- **E6 (§3.4, vazio e expiração):** acrescentar `motivoVazio: 'tudo-respondido'` (`n = 0` com sinais dispensados, feitos ou expirados) e a invariante `n = 0 ⇒ motivoVazio != null`; trocar "expirar marca `expired_at`" por "`niche_signals_expirar` roda também no outbox, sem `ligaCom`, de modo que o contador cai com o gravador parado"; o dedup do resumo é `'nicho-resumo:' || dia_sp || ':' || left(sha256(ids), 12)`; o resumo da 1ª execução do outbox do site é "N sugestões do nicho em aberto"; o `acao_do_dono` de 7 dias (já no spec) sai por `extra.acao`.
- **E7 (§3.4, aceite de tempo):** trocar "p95 < 225 s" por "p95 de `inicio_ms + ms` < 225 s", com `prazoMs = PESADA_FIM_MS − (agora − t0)`.
- **E8 (§7, F2 e D16):** a ação só de leitura `sugestoes` em `observatorio_leitura` entra na **F2** (não na F3); a F3 só acrescenta o pacote da tela.
- **E9 (volume):** trocar "~0,1 MB/ano" de `niche_signals` por "~5,5 MB/ano (até ~10 eventos/dia × ~1,5 KB; 3× canais ~16 MB), com `evidence.outliers` limitado a 20 entradas mais `outliers_total`; a F2 inteira (com `video_lugares` e `niche_outliers_vistos`) fica abaixo de 25 MB/ano".
