# F2 (Sinal via Cowork) Implementation Plan — r1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** gravar 1×/dia, por site, os sinais do nicho ("destino esquentou" em `pais:` e "vídeo parecido bombou") numa tabela única, notificar pelo sino por outbox e entregar a lista ao Cowork e ao Claude Code (rota + ação MCP) com o mesmo N.

**Architecture:** núcleo puro (`lib/youtube/observatorio/sinais/`) recebe uma projeção estreita (outliers já filtrados pela régua D6, vídeos próprios com lugar, `agora`) e devolve oportunidades ou `motivoVazio`; o lugar v0 é determinístico (`lib/youtube/observatorio/lugar/`), semeado de um JSON único que gera a migration e alimenta os testes. A borda (`sinais/gravador.ts`) monta o observatório pelo motor existente, recalcula `video_lugares` só onde o texto mudou e grava tudo numa chamada atômica `niche_signals_gravar`. Leitura só da tabela (`sinais/leitura.ts`), usada pela rota, pela ação MCP e (na F3) pela tela.

**Tech Stack:** Next.js 16, Supabase (Postgres 17, plpgsql, RLS), Vitest, Zod, agenda do A5.

**Spec:** `docs/superpowers/specs/2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md` (r14+): linha "F2 Sinal via Cowork" da §7, §2.4 T2/T3, §3.1–3.5, §3.7, §4, §8. Código de referência: `origin/main` b75595690 (A5 já promovida em 21/10).

## Global Constraints

- Migration só por `npm run db:new <nome>`; idempotente (`create ... if not exists`, `drop policy if exists` antes de `create policy`, `create or replace function`); `set lock_timeout = '5s'` no topo. Migration antes do código que grava (§7).
- Funções novas: `plpgsql`, `security invoker`, `set search_path = ''`, `revoke all ... from public, anon, authenticated; grant execute ... to service_role` (molde `yt_watch_reter`). Nunca chamar função sem EXECUTE no banco local (SIGSEGV): conferir com `has_function_privilege`.
- RLS: `niche_signals`, `niche_signals_estado`, `video_lugares` com leitura `public.can_edit_site(site_id)` (leitura sensível, nunca `site_visible`); `insert/update/delete` só `service_role`. `lugares`/`lugar_aliases` sem `site_id`: RLS ligada sem policy (só serviço). Teste que falsifica o GUC `app.site_id` como não-superusuário.
- Régua única (D6): `obs.outliers({ maxAge: 30, fmt })` com `!weak && phase.id === 'estourando'`, rodada para `fmt = 'long'` e `fmt = 'short'`. Nenhuma régua paralela.
- **D20:** nenhuma coluna de desempenho do vídeo próprio (views, CTR, nota, `vpd7`) entra na entrada da força, da ordenação ou de filtro de "destino esquentou" e "parecido". Garantido por tipo (`EntradaDaForca` não tem o campo) e por teste.
- Força, ordenação e texto: "pode ajudar", nunca "vai ajudar" (D2). Ordem pela `forca` (D15).
- Regra versionada: `REGRA_SINAIS.versao = 1`; `rule_version = 'sinais-v' + versao + '+semente-' + semente_versao`. Parâmetros iniciais (Phil confirma com a T1): `janelaDias 14`, `minOutliers 2`, `minCanais 2`, `multSozinho 5`, `nMinimo 8` (vídeos `tracked` com `vpd7` no formato, exatamente o conjunto de `median7`), `pisoViews 2000` (`vpd7 × 7` do mesmo `ObsVideo`), `validadeDias 30`, `carenciaDispensaDias 30`, `topParecidos 3`, `jaccardMin 0.3`, `tetoNotificacoesDia 5`, `tetoTentativas 3`.
- Notificação: `fanOutToSiteAdminsDetailed`, `domain: 'youtube'`, `type: 'youtube.niche_signal'`, `dedup_key 'nicho:' || id` e `'nicho-resumo:' || dia_sp`, `defaultChannels: []` (só sino; nunca `channels` nem override), payload só ids, `action_href` `/cms/youtube/competitors?aba=sugestoes` (a página ignora o parâmetro até a F3; a lista existe pelo Cowork). Sem migration de CHECK, sem mexer em `NotificationType`, no leitor do sino nem em `expire-notifications`.
- Flag `OBS_SINAIS_NICHO` (`ligaCom`): só o valor exato `on` liga `sinais_do_nicho`; ausente = desligada. `avisos_pendentes` **não** tem `ligaCom`. Variável no Vercel **antes** do deploy que a lê.
- Pipeline Integrity em toda rota nova: `api-registry.ts` (entrada + `endpoint_count` do domínio youtube 36 → 38), `apps/web/data/pipeline-docs/cowork-docs-youtube.md`, `docs/cowork-pipeline-reference.md` e reexecutar o seed da referência (memória). Nunca criar ou revogar chave.
- Paridade Cowork × Claude Code: os dois chegam por `youtube_observatory` (ação nova) e pela rota, ambos chamando a mesma `listarSinaisDoNicho`; um teste afirma JSON idêntico. `observatorio_leitura` (chave por pessoa) é mapeada a telas e ganha a ação `sugestoes` na F3, quando a tela existir (declarado em "Fora deste plano").
- LGPD (D5): payload, `evidence` e resposta do Cowork só com ids, números e chaves de lugar; nunca texto de comentário, autor ou imagem (D8).
- Envio: ≤ 3 pushes/dia/terminal até 27/10, combinados com a promoção; `--no-verify` só para docs ou hook falhando em arquivo de outro terminal. Nunca stash/reset. Passo do dono sempre `bash <arquivo>.sh`.
- Sem `any`; Zod em toda entrada de rota e ação MCP; kebab-case.

## Review Focus

1. **Outlier sem lugar, canal `sem-ritmo` ou canal abaixo de `nMinimo`** (falha em verde): a lista vazia tem de dizer por quê. Esperado: `niche_signals_estado.motivo_vazio` em `sem-terceiro-outlier | sem-lugar | sync-atrasado | sem-historico` e `contagens` com `outliers_sem_lugar`, `canais_sem_ritmo`, `canais_sem_n_minimo`; a leitura devolve isso, nunca `[]` mudo. Testes na T5 e T8.
2. **Gravador parado** (deploy quebrado, flag desligada depois de ligada): o N do Cowork e do sino não pode sobreviver. Esperado: leitura filtra `expires_at > now()`, devolve `desatualizado: true` com `computed_at` há > 36 h; sino cai porque o dispensar e o expirar marcam `notifications.expired_at`. Teste "relógio + 31 dias sem gravador" na T4 e T8.
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
| `niche_signals_estado` | gravador nunca rodou | leitura devolve `motivoVazio: 'nunca-calculado'` |
| outbox | `total === 0` (sem admin) | erro, conta tentativa; 3 → `notificacao_falhou_em`, tarefa vermelha |
| tarefa | `loadRows` estoura o prazo | `estado: 'erro'`, motivo `motor_estourou`; nada gravado, `estado` antigo vira `desatualizado` na leitura |

---

### Task 0: Preparação (controlador, sem código)

- [ ] Colar no ledger (`.superpowers/sdd/ab-lab/f2/ledger.md`) `git diff --name-only origin/main...<HEAD de cada worktree ativo da A5 e da F1a>` filtrado por `agenda/definicoes.ts|agenda/catalogo.ts|observatorio/outliers.ts|pipeline/api-registry.ts|cowork-docs-youtube.md|mcp/tools.ts`. Interseção com a F1a-dado: `definicoes.ts` e `catalogo.ts` (T12 dela). **Ordem:** se a T12 da F1a já estiver em `staging`, a T7 daqui rebaseia em cima; se não, as duas entradas são independentes (linhas novas, sem edição de linha alheia) e quem chega depois resolve o conflito trivial. A T9 daqui **exige** a T12 da F1a em `staging` (edita `avisos-pendentes.ts`).
- [ ] Refazer os `git grep` de §3.4 em `origin/main`: `outliers.ts:62` (`fmt: 'long'` padrão), `fan-out-to-admins.ts:73`, `catalogo.ts:30-32`, `relogio.ts` (`PESADA_FIM_MS = 285_000`). Divergência → ledger antes de codar.

Estimativa: ~15 mil tokens.

### Task 1: Script de custo do gravador e calibração T3 (só leitura; gate do `peso`)

**Files:**
- Create: `apps/web/scripts/f2-medir-gravador.ts`, `scripts/f2-medir-gravador.sh` (o `.sh` carrega `apps/web/.env.local` e roda `npx tsx`; saída em `.superpowers/sdd/ab-lab/f2/medida-gravador-<data>.json`)
- Test: `apps/web/test/youtube/observatorio/sinais/medir-gravador.test.ts` (só a função pura de projeção)

**Interfaces:**
- Produces: `export function projetarIdas(linhasDiaria: number, diasAtuais: number, diasAlvo: 90 | 365, linhasPorIda: 1000): number`; o JSON `{ etapas: {loadRows, rowsToDataset, createObservatory, outliersLong, outliersShort}: {p50, p95}[ms], idas, linhas, latenciaIda1000Ms, projecao: {d90, d365}: {idas, p95Ms}, t3: { porFormato: {long|short: {canais, canaisComNMinimo8, estourandoPorCanal: Record<string, number>}} } }`.

- [ ] **Step 1:** teste de `projetarIdas` com os números do spec: 14.814 linhas em 19 dias, alvo 365 → ≈ 285 idas (tolerância ±5). FAIL.
- [ ] **Step 2:** implementar. O script usa `getSupabaseServiceClient()` só com SELECT, chama `loadRows`/`rowsToDataset`/`createObservatory`/`outliers` 5 vezes **sem** `unstable_cache` (chamada direta, não `loadObservatory` do serviço) e cronometra cada etapa; mede uma ida de 1.000 linhas de `competitor_video_daily`; T3 conta, por canal e formato, vídeos `tracked` com `vpd7` (o conjunto de `median7`) e a taxa de `estourando` **pelo motor**. PASS.
- [ ] **Step 3: passo do dono** (leitura de produção negada no modo automático): `bash scripts/f2-medir-gravador.sh`. Resultado no ledger.
- [ ] **Step 4: decisão escrita no ledger:** `peso: 'pesada', cedeA: ['sincronizar_canais']` (padrão); `leve` só se `projecao.d365.p95Ms <= 10_000`. Se `canaisComNMinimo8` < metade dos canais em `long`, Phil fixa `nMinimo` antes da T5 (o valor vai a `REGRA_SINAIS`).

**Aceite:** JSON no ledger com p95 por etapa e projeção a 365 d; decisão de peso e `nMinimo` escrita. Estimativa: ~60 mil tokens.

### Task 2: Migration A — `lugares`, `lugar_aliases`, `video_lugares` e semente

**Files:**
- Create: `apps/web/data/lugares/semente-v1.json` (fonte única: `{ versao: 1, lugares: [{slug, pais_iso2, nivel: 'pais'|'local', aliases: [{alias, ambiguo}]}] }`; ~250 países em pt, en e nome local, mais ~100 destinos do nicho de viagem, incluindo os do teste da T3; `ambiguo: true` em Natal, Porto, Lima, Cuba, Salvador, Belém, Vitória, Georgia, Jordan, Chad, Turkey)
- Create: `apps/web/scripts/gerar-semente-lugares.ts` (lê o JSON, aplica `normalizarLugar` da T3, recusa alias normalizado repetido entre slugs, imprime o SQL `insert ... on conflict (alias_norm) do update set slug, ambiguo, semente_versao`)
- Create: migration por `npm run db:new f2_lugares` (tabelas + RLS) e, colado do script, o bloco de semente no mesmo arquivo
- Test: `apps/web/test/integration/f2-lugares-rls.test.ts`, `apps/web/test/youtube/observatorio/lugar/semente.test.ts`

**Interfaces:**
- Produces (schema): `lugares(slug text primary key, pais_iso2 char(2) not null, nivel text not null check (nivel in ('pais','local')))`; `lugar_aliases(alias_norm text primary key, slug text not null references lugares on delete cascade, ambiguo boolean not null default false, semente_versao smallint not null)`; `video_lugares(video_id uuid primary key, site_id uuid not null references sites on delete cascade, origem text not null check (origem in ('competidor','proprio')), chaves text[] not null, fonte text not null check (fonte in ('texto','texto+coordenada')), entrada_hash text not null, semente_versao smallint not null, computado_em timestamptz not null)`, índice `(site_id, origem)` e GIN em `chaves`. Slugs: `pais:VN`, `local:vn-phu-quoc`.

- [ ] **Step 1:** testes: semente sem alias normalizado duplicado; todo `local:` tem `pais_iso2` com `pais:` correspondente; os 11 ambíguos marcados; "Turquia"/"Türkiye" não ambíguos e apontando para `pais:TR`. Integração: `authenticated` sem `can_edit_site` lê 0 linhas de `video_lugares` mesmo com `app.site_id` falsificado; `authenticated` não lê `lugar_aliases`; `insert` por `authenticated` recusado. FAIL.
- [ ] **Step 2:** JSON, script (depende de `normalizarLugar`: fazer a T3 Step 3 antes deste passo ou na mesma sessão), migration. `npm run db:reset` no banco 54421. PASS.
- [ ] **Step 3:** commit (`feat: F2 tabelas de lugar e semente v1`).

**Aceite:** testes verdes; `select count(*) from lugar_aliases` ≥ 700 no banco local. `db:push:prod` só no envio F2-1, depois da revisão de Phil e Yannis. Estimativa: ~90 mil tokens.

### Task 3: Lugar v0 — `normalizarLugar`, índice de n-gramas e extração

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/lugar/normalizar.ts`, `.../lugar/casar.ts`, `.../lugar/coordenada.ts`
- Test: `apps/web/test/youtube/observatorio/lugar/casar.test.ts` (`// @vitest-environment node`; usa `data/lugares/semente-v1.json` de verdade)

**Interfaces:**
- Produces: `export function normalizarLugar(s: string): string` (NFD sem marcas + dobra `đ→d, ł→l, ø→o, ı→i, æ→ae, œ→oe, ß→ss`, minúsculas, pontuação → espaço, espaços colapsados); `export interface IndiceDeLugar { porAlias: Map<string, { slug: string; ambiguo: boolean; pais: string }>; nMax: number; versao: number }`; `export function montarIndice(aliases: ReadonlyArray<{alias_norm: string; slug: string; ambiguo: boolean; pais_iso2: string}>, versao: number): IndiceDeLugar`; `export interface EntradaDeLugar { titulo: string; tags: readonly string[]; descricaoInicio: string; locationDescription: string | null; coordenadaPadraoDoCanal: boolean }`; `export function extrairLugares(e: EntradaDeLugar, ind: IndiceDeLugar): { chaves: string[]; fonte: 'texto' | 'texto+coordenada' }` (até 3 chaves, ordenadas pela posição no título, depois tags, descrição; cada `local:` também emite o seu `pais:`, e o teto de 3 conta só `pais:`); `export function entradaHash(e: EntradaDeLugar, versao: number): string` (sha256 hex do JSON normalizado); `export function paresPadrao(videos: ReadonlyArray<{canal: string; lat: number | null; lng: number | null}>): Set<string>` (chave `canal|lat.toFixed(1)|lng.toFixed(1)` com ≥ 5 vídeos). `descricaoInicio` = primeiros 300 caracteres.
- Regra do ambíguo: casa só com segundo sinal: outro alias do **mesmo país** em tags ou descrição, preposição `em|in|to|na|no` imediatamente antes, ou `locationDescription` (não padrão) casando o mesmo país.

- [ ] **Step 1: testes de tabela (§2.4 T2):** casam `Phú Quốc`, `Phu Quoc`, `Đảo Phú Quốc`, `Ilha de Phu Quoc` → `local:vn-phu-quoc` + `pais:VN`; `Vietnã`, `Vietnam`, `Hồ Chí Minh`, `Łódź`, `İstanbul`, `Tromsø`; "Georgia" e "Natal" sozinhos → `[]`; "Turquia" sozinho → `pais:TR`; "Turkey" sozinho → `[]`; "Turkey" + "Istanbul" na descrição → `pais:TR`; "Tailândia, Vietnã e Camboja em 15 dias" → `['pais:TH','pais:VN','pais:KH']` nessa ordem; `locationDescription` com `coordenadaPadraoDoCanal: true` não contribui; canal sintético com 10 vídeos na mesma coordenada → `paresPadrao` contém o par; `entradaHash` estável para a mesma entrada e diferente com `versao` 2; 20 títulos negativos (`"Porto seguro de vida"`, `"Natal em família"`, `"Chad reage"`, `"Lima limão receita"`, …) → `[]`. FAIL.
- [ ] **Step 2:** implementar. Casamento por janela deslizante de n-gramas de tokens (n de `nMax` a 1, o maior vence e consome os tokens): O(T·nMax) por texto, nunca O(aliases·T). PASS.
- [ ] **Step 3:** commit (`feat: F2 lugar v0 determinístico`).

**Aceite:** acima; nenhum import de banco. Estimativa: ~70 mil tokens.

### Task 4: Migration B — `niche_signals`, `niche_signals_estado` e as funções de gravar e dispensar

**Files:**
- Create: migration por `npm run db:new f2_niche_signals`
- Test: `apps/web/test/integration/f2-niche-signals.test.ts`, `apps/web/test/integration/f2-niche-signals-rls.test.ts`

**Interfaces:**
- Produces (schema): `niche_signals(id uuid pk default gen_random_uuid(), site_id uuid not null references sites on delete cascade, kind text not null check (kind in ('destino','parecido')), subject_key text not null, rule_version text not null, evidence jsonb not null, forca numeric(8,2) not null, acao text not null check (acao in ('titulo_descricao','playlist','video_novo','titulo_complementar','thumbnail_ideias')), status text not null default 'aberto' check (status in ('aberto','dispensado','feito','expirado')), first_seen_at timestamptz not null, computed_at timestamptz not null, expires_at timestamptz not null, adiado_ate timestamptz, dispensado_em timestamptz, motivo text not null, notificar_como text not null default 'individual' check (notificar_como in ('individual','resumo')), notificado_em timestamptz, notificacao_tentativas smallint not null default 0, notificacao_falhou_em timestamptz)`; índice único parcial `(site_id, kind, subject_key) where status = 'aberto'`; índice `(site_id, status, expires_at)`; índice parcial `(site_id) where notificado_em is null and notificacao_falhou_em is null and status = 'aberto'`. `kind` já aceita só os dois da F2; "meu vídeo caiu" (F4) estende o CHECK.
- `niche_signals_estado(site_id uuid pk references sites on delete cascade, computed_at timestamptz not null, rule_version text not null, motivo_vazio text check (motivo_vazio in ('sem-historico','sem-terceiro-outlier','sem-lugar','sync-atrasado')), contagens jsonb not null)`.
- `evidence` (F2b, §3.6): `{ outliers: [{ video_id, canal_id, published_at, mult, vpd7, formato }], canais: n, proprios: [video_id...] }`; `published_at` e `canal_id` gravados **na criação** e nunca mais alterados (a função mescla só `forca`, contagens e a lista de outliers **acrescentando** novos, nunca removendo nem mudando os existentes).
- `public.niche_signals_gravar(p_site uuid, p_lote jsonb, p_estado jsonb, p_linha_de_base boolean) returns jsonb` (`{novos, atualizados, expirados}`), numa transação: (1) `expirado` onde `aberto and expires_at <= now()` e `update notifications set expired_at = now() where domain = 'youtube' and type = 'youtube.niche_signal' and dedup_key = 'nicho:' || id and expired_at is null`; resumo (`dedup_key like 'nicho-resumo:%'`) expira quando nenhum id de `payload->'ids'` continua `aberto`; (2) `insert ... on conflict (site_id, kind, subject_key) where status = 'aberto' do nothing`, pulando chave com `dispensado` e `dispensado_em > now() - interval '30 days'`; com `p_linha_de_base` grava `notificar_como = 'resumo'`; `expires_at = first_seen_at + 30 d` (validade fixa; o ciclo `expirado → novo` é intencional, Yannis M4); (3) `update` de `evidence`, `forca`, `rule_version`, `computed_at` só em `aberto`, nunca `status`/`dispensado_*`/`expires_at`; (4) upsert de `niche_signals_estado`.
- `public.niche_signals_dispensar(p_site uuid, p_id uuid, p_status text, p_motivo text) returns jsonb` (`p_status in ('dispensado','feito')`; só de `aberto`; `{ok: true}` ou `{ok: false, motivo: 'nao_encontrado'|'nao_aberto'}`; mesmo `update notifications` do passo 1).

- [ ] **Step 1: testes (banco 54421, `describe.skipIf(skipIfNoLocalDb())`):** duas chamadas concorrentes com o mesmo lote → 1 linha; falha injetada no passo 3 (lote com `forca` inválida) desfaz 1 e 2; dispensar → regravar → continua `dispensado` e nada novo; carência 29 d bloqueia, 31 d cria (relógio por `update dispensado_em`); `evidence.outliers[0].published_at` não muda depois de um 2º lote com outro valor; **dispensar derruba o que `/api/notifications/count` lê** (consulta idêntica à da rota: `dismissed_at`, `expired_at`, `read_at` nulos); linha com `expires_at` passado + nova chamada → `expirado` e notificação expirada (o "gravador parado por 31 dias" visto na 1ª execução seguinte; a leitura já o esconde antes, T8); `has_function_privilege('authenticated', ..., 'execute') = false`; RLS: não-membro com GUC falsificado lê 0 linhas de `niche_signals` e `niche_signals_estado`. FAIL.
- [ ] **Step 2:** migration. PASS. **Step 3:** commit (`feat: F2 niche_signals e gravação atômica`).

**Aceite:** acima. Estimativa: ~120 mil tokens.

### Task 5: Núcleo puro `oportunidades.ts`

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/regra.ts` (`REGRA_SINAIS`), `.../sinais/oportunidades.ts`, `.../sinais/tokens.ts`
- Test: `apps/web/test/youtube/observatorio/sinais/oportunidades.test.ts` (literais, sem `createObservatory`)

**Interfaces:**
- Consumes: chaves de `extrairLugares` (T3).
- Produces:
  - `export interface OutlierProjetado { videoId: string; canalId: string; formato: 'long' | 'short'; publishedAt: string; mult: number; vpd7: number; nCanal: number; chaves: string[]; tokens: string[] }`
  - `export interface ProprioProjetado { videoId: string; formato: 'long' | 'short' | null; chaves: string[]; tokens: string[] }` — **sem** views/CTR/nota (D20)
  - `export interface EntradaDoNucleo { outliers: OutlierProjetado[]; proprios: ProprioProjetado[]; canaisSemRitmo: number; canaisTotal: number; outliersSemLugar: number; agora: Date; semente: number }`
  - `export interface Oportunidade { kind: 'destino' | 'parecido'; subjectKey: string; acao: 'titulo_descricao' | 'video_novo' | 'playlist'; forca: number; motivo: string; evidence: Evidence; alvos: string[] }`
  - `export type MotivoVazio = 'sem-historico' | 'sem-terceiro-outlier' | 'sem-lugar' | 'sync-atrasado'`
  - `export function calcularOportunidades(e: EntradaDoNucleo): { itens: Oportunidade[]; motivoVazio: MotivoVazio | null; contagens: Record<string, number> }`
  - `export type EntradaDaForca = { mults: number[]; canais: number; idadeDias: number }`; `export function forcaDe(f: EntradaDaForca): number` = `round2(Σ log2(mult) × (1 + 0.5 × (canais − 1)) × max(0.2, 1 − idadeDias / 30))`, `idadeDias` contada do `publishedAt` mais recente da evidência.
  - `export function tokensDe(texto: string): string[]` (`normalizarLugar` + stopwords pt/en fixas em `tokens.ts`, tokens ≥ 3 letras, únicos).
- Regras (§3.1, §3.2, §4): outlier entra só com `nCanal >= nMinimo` e `vpd7 × 7 >= pisoViews` (senão conta `sem_n_minimo`/`abaixo_do_piso`); **destino** por chave `pais:` com (≥ 2 outliers de ≥ 2 canais na janela de 14 d por `publishedAt`) **ou** (1 outlier com `mult >= multSozinho`); `acao = 'titulo_descricao'` com `alvos` = próprios com a chave (ordenados por id, nunca por desempenho), `'video_novo'` sem próprio; **parecido** por outlier com `jaccard(tokens) >= jaccardMin` e mesmo formato (próprio com `formato: null` passa e o motivo diz "formato não confirmado"), até `topParecidos` alvos por Jaccard; frase "mesmo lugar e mesmo tema" quando também divide chave, "tema parecido, lugar diferente" quando não. `motivo` cita os números, `REGRA_SINAIS.versao`, a semente e "piso: vpd7 × 7 do próprio vídeo do terceiro"; texto "pode ajudar". `motivoVazio` só com `itens` vazio, na ordem: `canaisTotal = 0` → `sem-historico`; `canaisSemRitmo = canaisTotal` → `sync-atrasado`; zero outliers → `sem-terceiro-outlier`; todos os outliers sem chave → `sem-lugar`.

- [ ] **Step 1: testes:** 2 outliers `pais:VN` de 2 canais → 1 destino com `alvos` = próprios VN; 2 outliers do **mesmo** canal → nenhum (Phil A3); 1 outlier `mult 6` → destino; 1 outlier `mult 4` → nenhum; outlier com `nCanal 7` → nenhum e `contagens.sem_n_minimo = 1`; `vpd7 × 7 = 1999` → nenhum; sem próprio → `acao 'video_novo'`; **D20:** mesma entrada com o próprio sendo "o melhor do canal" e "o pior" produz `itens` deep-equal (o tipo não tem o campo: `expectTypeOf<ProprioProjetado>().not.toHaveProperty('views')` e idem `ctr`, `vpd7`, `nota`; `expectTypeOf<EntradaDaForca>()` só com `mults`, `canais`, `idadeDias`); parecido com Jaccard 0.29 → nenhum, 0.31 → um; Short do terceiro não casa próprio `long`; `forcaDe({mults:[4,4], canais:2, idadeDias:0}) = 6`; os quatro `motivoVazio` com histórico apagado (`canaisTotal 0`, todos sem ritmo, zero outliers, todos sem chave); `motivo` contém `v1` e o número de canais; nada de `[]` com `motivoVazio` nulo. FAIL.
- [ ] **Step 2:** implementar. PASS. **Step 3:** commit (`feat: F2 núcleo dos sinais do nicho`).

**Aceite:** acima; o arquivo não importa banco nem `EngineCtx`. Estimativa: ~110 mil tokens.

### Task 6: Borda — projeção a partir do motor e `video_lugares`

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/projecao.ts`, `.../sinais/lugares-do-site.ts`
- Test: `apps/web/test/youtube/observatorio/sinais/projecao.test.ts`, `apps/web/test/youtube/observatorio/sinais/lugares-do-site.test.ts`

**Interfaces:**
- Consumes: `loadRows`, `rowsToDataset`, `createObservatory` (`observatorio/load.ts`, `index.ts`), `median7` (`outliers.ts`), T3, T5.
- Produces:
  - `export function projetarOutliers(obs: Observatory, ctx: EngineCtx, lugarDe: (videoId: string) => string[], textoDe: (videoId: string) => string): { outliers: OutlierProjetado[]; canaisSemRitmo: number; canaisTotal: number; outliersSemLugar: number }` — chama `obs.outliers({ maxAge: 30, fmt })` para `long` e `short`, filtra `!weak && phase.id === 'estourando'`; `nCanal` = tamanho do conjunto de `median7` (vídeos `tracked` do canal com `vpd7` no formato); `canaisSemRitmo` pelos canais cuja `phaseOf` é `sem-ritmo`.
  - `export async function sincronizarLugares(sb: SupabaseClient, siteId: string, rows: ObservatoryRows, proprios: ProprioRow[], indice: IndiceDeLugar, agora: Date): Promise<{ lugarDe: (videoId: string) => string[]; regravados: number; inalterados: number }>` — lê `video_lugares` do site, recalcula em memória (O(V·T)) e faz upsert **só** onde `entrada_hash` ou `semente_versao` mudou. Texto do competidor: `competitor_video_versions.value_text` atual (`is_current`) de `title` e `description` + `competitor_videos.tags`; `locationDescription` e coordenada por `competitor_raw` com `select('video_id, rd:raw->recordingDetails').eq('is_current', true)` (nunca o `raw` inteiro); próprio: `youtube_videos.title/description/tags` (sem coordenada).
  - `export interface ProprioRow { id: string; title: string; description: string | null; tags: string[]; is_short: boolean | null }` (formato pela última linha de `yt_own_video_meta_daily.is_short`; nulo fica nulo).

- [ ] **Step 1: testes** com `ObservatoryRows` sintético (fábrica existente dos testes de `outliers.test.ts`): o mesmo vídeo `estourando` aparece na projeção e em `obs.outliers()` da tela (paridade com o motor); `weak` fora; Short entra só na rodada `short`; segunda chamada de `sincronizarLugares` sem mudança → `regravados 0` e nenhum upsert (spy no cliente); título alterado → só aquele vídeo regravado; semente 2 → todos regravados; `select` de `competitor_raw` nunca pede `raw` inteiro (afirmar a string do select). FAIL.
- [ ] **Step 2:** implementar. PASS. **Step 3:** commit.

**Aceite:** acima. Estimativa: ~110 mil tokens.

### Task 7: Tarefa `sinais_do_nicho` na agenda (+ flag e doc)

**Files:**
- Modify: `apps/web/src/lib/youtube/agenda/definicoes.ts` (nova `DEFINICAO_SINAIS_DO_NICHO`, entra em `TODAS_AS_DEFINICOES`)
- Modify: `apps/web/src/lib/youtube/agenda/catalogo.ts` (uma importação, uma entrada)
- Create: `apps/web/src/lib/youtube/agenda/tarefas/sinais-do-nicho.ts`, `apps/web/src/lib/youtube/observatorio/sinais/gravador.ts`
- Modify: `docs/ops/env-vars.md` (linha `OBS_SINAIS_NICHO`: `on` liga; ausente/qualquer outro = desligada; liga só depois do portão de precisão da T10; dono: controlador do A/B Lab)
- Test: `apps/web/test/youtube/agenda/catalogo.test.ts` (casos novos), `apps/web/test/youtube/observatorio/sinais/gravador.test.ts`

**Interfaces:**
- Definição: `nome: 'sinais_do_nicho'`, `rotulo: 'sinais do nicho'`, `ordem: 8.5`, `peso: 'pesada'` (ou o que a T1 decidir), `cedeA: ['sincronizar_canais']`, `periodo: 'dia'`, `aPartirDaHoraSP: 7` (depois de `marcas_de_idade` às 4 e da série do dia; antes de `avisos_pendentes` às 9, para a notificação sair no mesmo dia; fora de 12–13, onde moram `serie_semanal` e `retratos_comentarios`), `tetoTentativas: 12`, `toleranciaVigiaH: 36`, `naoTerminouVermelhoEm: null`, `comecaAteMs: 120_000`, `fimAteMs: PESADA_FIM_MS`, `ligaCom: 'OBS_SINAIS_NICHO'`, `motivos: { motor_estourou, gravar_falhou, site_falhou, schema_ausente, inesperado }`.
- `export async function rodarSinaisDoNicho(p: { sb: SupabaseClient; agora: Date; prazoMs: number }): Promise<{ sites: number; novos: number; atualizados: number; expirados: number; falhas: number; ms: number }>` — sites = `site_id` distintos de `competitor_channels`; por site, em sequência: `loadRows` (com `comPrazo`), `sincronizarLugares`, `projetarOutliers`, `calcularOportunidades`, `niche_signals_gravar` (com `p_linha_de_base` = site sem nenhuma linha em `niche_signals`). Um site que falha conta em `falhas` e não impede o próximo (passos isolados, §3.4); a tarefa fica `erro` com `site_falhou` se `falhas > 0`. Ponto de extensão para a F2b: lista `PASSOS_DEPOIS: Array<(c) => Promise<void>>` vazia, cada passo em `try/catch` próprio.
- `detalhe` (só números): `sites`, `novos`, `atualizados`, `expirados`, `falhas`, `ms`, `outliers`, `outliers_sem_lugar`, `lugares_regravados`.

- [ ] **Step 1: testes:** `catalogo.test.ts`: **variável `OBS_SINAIS_NICHO` apagada** (`delete process.env.OBS_SINAIS_NICHO` com `vi.unstubAllEnvs`) → `sinais_do_nicho` em `desligadas`; `'ON'` e `'1'` → desligada; `'on'` → ligada; definição sem `nuncaDesliga`; gravador: site A lança, site B grava (spy na RPC chamada 1×); `loadRows` estoura o prazo → `motor_estourou`, nenhuma RPC; 1ª execução passa `p_linha_de_base = true`, 2ª `false`; nenhum texto de fora em `motivo`/`detalhe`. FAIL.
- [ ] **Step 2:** implementar (molde de `marcas-de-idade.ts`: exceção vira `inesperado`, só classe e SQLSTATE ao Sentry). PASS. **Step 3:** commit.

**Aceite:** acima; `npx vitest run test/youtube/agenda` verde. Estimativa: ~80 mil tokens.

### Task 8: Leitura, rota, ação MCP e Pipeline Integrity

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/leitura.ts`, `apps/web/src/lib/pipeline/services/niche-signals.ts`
- Create: `apps/web/src/app/api/pipeline/youtube/competitors/signals/route.ts` (GET, `authenticateRead`), `apps/web/src/app/api/pipeline/youtube/competitors/signals/[id]/dismiss/route.ts` (POST, `authenticateWrite`)
- Modify: `apps/web/src/lib/pipeline/mcp/tools.ts` (`YoutubeObservatoryShape`: `action` ganha `get_signals` e `dismiss_signal`; parâmetros `signal_id: z.string().uuid().optional()`, `status: z.enum(['dispensado','feito']).optional()`, `motivo: z.enum(['nao_e_parecido','lugar_errado','ja_fiz','nao_interessa']).optional()`)
- Modify: `apps/web/src/lib/pipeline/mcp/services/youtube-observatory.ts` (`PARAMETROS_LIDOS` + dois `case`; `dismiss_signal` exige `write` com o mesmo `FORBIDDEN` de `items.ts:34`)
- Modify: `apps/web/src/lib/pipeline/api-registry.ts` (2 entradas; `endpoint_count` youtube 36 → 38), `apps/web/data/pipeline-docs/cowork-docs-youtube.md` (as duas rotas e as duas ações: "pode ajudar", "associação, não causa", `motivoVazio` citado como está, nunca lido como "nada no nicho"), `docs/cowork-pipeline-reference.md` (forma da resposta)
- Test: `apps/web/test/youtube/observatorio/sinais/leitura.test.ts`, `apps/web/test/api/pipeline/competitors-signals.test.ts`, `apps/web/test/mcp/youtube-observatory-parametros.test.ts` (casos novos), `apps/web/test/integration/f2-leitura-paridade.test.ts`

**Interfaces:**
- Produces: `export interface ListaDeSinais { n: number; itens: Array<{ id: string; kind: 'destino' | 'parecido'; subject_key: string; acao: string; forca: number; motivo: string; rule_version: string; evidence: Evidence; first_seen_at: string; expires_at: string }>; computado_em: string | null; desatualizado: boolean; motivoVazio: MotivoVazio | 'nunca-calculado' | null; contagens: Record<string, number> }`; `export async function listarSinaisDoNicho(sb: SupabaseClient, siteId: string, agora: Date, limite = 50): Promise<ListaDeSinais>` — uma consulta `where status = 'aberto' and (adiado_ate is null or adiado_ate <= now) and expires_at > now order by forca desc, first_seen_at` com `count: 'exact'` (N = total, não o tamanho da página) e uma leitura de `niche_signals_estado`; `desatualizado = computado_em < agora − 36 h`. `export async function dispensarSinal(sb, siteId, id, status, motivo): Promise<{ ok: boolean; motivo?: string }>` (chama `niche_signals_dispensar`; id de outro site → `nao_encontrado`).

- [ ] **Step 1: testes:** linha com `expires_at` passado e `status = 'aberto'` (gravador parado) **não** entra no N; `estado` com `computed_at` de 37 h → `desatualizado: true`; sem `estado` → `'nunca-calculado'`; zero abertos com estado `sem-lugar` → `motivoVazio: 'sem-lugar'` e `contagens.outliers_sem_lugar`; rota GET e `youtube_observatory get_signals` devolvem JSON deep-equal sobre o mesmo banco (integração, paridade D16); `dismiss_signal` com chave `read` → `FORBIDDEN`; `dismiss_signal` derruba o N da próxima `get_signals`; `PARAMETROS_LIDOS` ⇔ `YoutubeObservatoryShape` nos dois sentidos (teste existente, agora com os novos); `api-registry.test.ts` e `registry-completeness.test.ts` verdes com 38; payload sem campo de texto de comentário nem URL de imagem (afirmar chaves de `evidence`). FAIL.
- [ ] **Step 2:** implementar. PASS. **Step 3:** reexecutar o seed da referência do Cowork (memória `reference_cowork_pipeline_schemas`) **no envio**, não antes. **Step 4:** commit.

**Aceite:** acima. Estimativa: ~120 mil tokens.

### Task 9: Outbox do nicho em `avisos_pendentes`

**Pré-requisito:** T12 da F1a-dado em `staging` (Task 0).

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/avisos.ts`
- Modify: `apps/web/src/lib/youtube/agenda/tarefas/avisos-pendentes.ts` (uma chamada a `enviarAvisosDoNicho` depois da parte do nativo, em `try/catch` próprio: falha do nicho deixa a tarefa `erro` com motivo `nicho_falhou` mas não desfaz nem impede o lembrete do dia 14; contadores `nicho_enviados`, `nicho_resumidos`, `nicho_falhas` no `detalhe`; motivo novo no catálogo da definição)
- Test: `apps/web/test/youtube/observatorio/sinais/avisos.test.ts`, `apps/web/test/integration/f2-avisos-sino.test.ts`

**Interfaces:**
- Produces: `export function planejarAvisos(pendentes: ReadonlyArray<{ id: string; forca: number; notificar_como: 'individual' | 'resumo'; notificacao_tentativas: number }>, jaEnviadosHojeIndividual: number, teto: number): { individuais: string[]; resumo: string[] }` (puro: os `teto − jaEnviados` de maior `forca` com `notificar_como = 'individual'` vão um a um; o resto e todos os `resumo` vão no resumo do dia); `export async function enviarAvisosDoNicho(sb: SupabaseClient, agora: Date): Promise<{ enviados: number; resumidos: number; falhas: number }>` — por site com pendentes; cada envio por `fanOutToSiteAdminsDetailed` (`defaultChannels: []`); marca `notificado_em` **só** se `total > 0 && errors.length === 0` (suprimido por dedup = entregue); senão `notificacao_tentativas + 1` e, ao chegar a 3, `notificacao_falhou_em = now()` e falha contada (vermelho na execução que chega a 3; depois a linha fica fora dos pendentes, sem reenvio). Resumo: `dedup_key 'nicho-resumo:' || dia_sp` (`dia_sp` por `spDate`), `payload { ids }`, título "N sugestões novas do nicho".

- [ ] **Step 1: testes:** `planejarAvisos` com 8 individuais e teto 5 → 5 + 3 no resumo; 2 já enviados hoje → 3 + 5; linha de base (20 `resumo`) → 0 individuais e 1 resumo com 20 ids; **integração lendo o que o sino lê** (consulta de `/api/notifications/count` para o admin semeado): uma sugestão vira +1, dispensar pela T8 vira −1; dono sem `notification_preferences` → nenhuma linha em `notification_deliveries` (nome exato da tabela de entregas conferido no Step 0) fora do sino; `total === 0` → tentativa +1 e falha; falha na 1ª e sucesso na 2ª → 1 notificação (dedup); 3 falhas → `notificacao_falhou_em` e a 4ª execução não tenta; **`OBS_SINAIS_NICHO` apagada → `avisos_pendentes` ligada e a parte do nicho roda (tabela vazia → `nicho_enviados 0`)**; erro forçado no nicho não impede o lembrete do dia 14 (spy). FAIL.
- [ ] **Step 2:** implementar. PASS. **Step 3:** commit.

**Aceite:** acima. Estimativa: ~100 mil tokens.

### Task 10: Portão de precisão do lugar, revisão e envios

**Files:**
- Create: `apps/web/scripts/f2-amostra-lugar.ts`, `scripts/f2-amostra-lugar.sh` (só SELECT; reaproveita T3 e T6 sem gravar; saída `.superpowers/sdd/ab-lab/f2/amostra-lugar-<data>.csv` com `video_id, canal, titulo, chaves_calculadas, fonte`)

- [ ] **Step 1:** o script sorteia (semente fixa) 100 outliers de terceiros (todas as fases, 90 d, long e short) **mais** os 20 títulos negativos da T3. Passo do dono: `bash scripts/f2-amostra-lugar.sh`.
- [ ] **Step 2:** o controlador rotula à mão a coluna `chaves_corretas` (o país do assunto do vídeo); precisão = chaves calculadas corretas ÷ chaves calculadas ≥ **0,90**; cobertura (vídeos com chave ÷ 100) anotada, sem portão. Resultado e erros no ledger. Abaixo de 0,90: corrigir semente/ambíguos (nova `semente_versao`), repetir; a flag não liga.
- [ ] **Step 3: revisão** de Phil (`phil-dados`) e Yannis (`yannis-software`) sobre o diff das T2–T9; consertos até acordo.

**Aceite:** precisão ≥ 0,90 no ledger antes de `OBS_SINAIS_NICHO=on`. Estimativa: ~50 mil tokens + revisão ~150 mil.

## Envios e calendário

| Envio | Conteúdo | Ordem e condição | Data-alvo | O que muda em produção |
|---|---|---|---|---|
| **F2-1** | T2, T3, T4, T5 | revisão Phil/Yannis do lote; `npm run db:push:prod` (controlador, após portão) **antes** do push; push combinado com a promoção do dia (≤ 3/dia) | 23–24/10 | tabelas e funções vazias; código sem consumidor |
| **F2-2** | T6, T7, T8 (e T9 se a T12 da F1a já estiver em `staging`) | T1 decidida; portão de precisão (T10) **antes** do push; se passou, `OBS_SINAIS_NICHO=on` no Vercel **antes** do deploy; se não, sobe sem a variável e liga num push seguinte (custa um build, combinar) | 25–27/10 | rota e ação MCP no ar; gravador roda às 07:00 SP do dia seguinte com a flag |
| **F2-3** | T9 (se não coube no F2-2) | T12 da F1a em produção | com o envio 1c da F1a | sino recebe sugestões |

## Conferências datadas (controlador; resultado no ledger)

- **D0** (1ª execução com a flag): `competitor_agenda_runs` de `sinais_do_nicho` com `status = 'ok'`, `detalhe.sites ≥ 1`; `select kind, count(*), min(rule_version) from niche_signals group by 1`; `niche_signals_estado` com `computed_at` de hoje; **uma** notificação-resumo por admin; `get_signals` pelo Cowork e pela rota com o mesmo `n`.
- **D+1:** linhas novas com `notificar_como = 'individual'` ≤ 5 notificações individuais; `notificacao_falhou_em` nulo em todas.
- **D+7:** reexecuções sem duplicata (`select site_id, kind, subject_key, count(*) from niche_signals where status = 'aberto' group by 1,2,3 having count(*) > 1` vazio); `lugares_regravados` perto de 0 nos dias sem vídeo novo.
- **D+30:** p95 de `ms` de `sinais_do_nicho` em `competitor_agenda_runs` < 225 s (`PESADA_FIM_MS − 60 s`); primeiras linhas `expirado` e a notificação correspondente com `expired_at`.
- **D+90:** p95 de novo, com a série diária maior; comparar com a projeção da T1.

## Estimativa total

T0 15 mil · T1 60 mil · T2 90 mil · T3 70 mil · T4 120 mil · T5 110 mil · T6 110 mil · T7 80 mil · T8 120 mil · T9 100 mil · T10 50 mil · revisões ~150 mil ⇒ **~1,08 milhão de tokens** (Sonnet executa; Opus só na 1ª revisão).

## Fora deste plano

F2b (medida de D2: `niche_signal_efeitos`, janela, C4; a âncora `published_at`/`canal_id` já fica em `evidence` na criação, e `PASSOS_DEPOIS` da T7 é o ponto de entrada); F3 (tela, server action dispensar/feito com `requireSiteAdmin`, chip "candidato" e `getSuggestedVideos` lendo a lista, ação `sugestoes` em `observatorio_leitura`); F4 ("meu vídeo caiu", thumbnail como análise, título complementar, forja propondo aliases, `local:` como chave de evento); dívida de `outliers.ts:30` (`2 *` fixo, `m7` por item; §3.4).
