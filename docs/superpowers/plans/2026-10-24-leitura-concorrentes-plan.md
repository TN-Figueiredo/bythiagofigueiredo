# Leitura dos concorrentes pelo título exibido (regra v2 da T13): plano de implementação

> **Para agentes executores:** sub-skill obrigatória: superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**r1, 24/10/2026.** Ainda sem revisão.

**Objetivo.** Trocar a regra v1 do observador de concorrentes pela regra v2, que lê `titulo_exibido` da leitura bloqueada (envio A, com a flag off), e expor a leitura ao Cowork pelo domínio `youtube` da pipeline e pela tool MCP `youtube_observatory` (envio B).

**Arquitetura.** A regra continua pura em `observados/inferir.ts`: ela agrupa as leituras por rodada e decide por janelas (W, W₋₁, W⁻), como o protótipo `prototipo/replay_v2_mistas_hist.py`. Dois módulos puros novos, `guarda.ts` e `alarme.ts`, levam a lógica da guarda §6.2 e do alarme §6.1. O I/O fica em `passo.ts` e num `avisos.ts` novo do observador, ligado como mais uma parte de `rodarAvisos`. A leitura (`estado-de-leitura.ts` + `textos.ts`) é a única fonte do texto, usada pelo ensaio a seco e pelo serviço do envio B.

**Stack.** TypeScript 5 strict, Vitest, Supabase JS (PostgREST), Next 16 (rota da pipeline), MCP SDK.

**Spec:** `docs/superpowers/specs/2026-10-24-leitura-concorrentes-design.md` (r2.1, com acordo). O executor lê o spec inteiro antes da 1ª tarefa; o plano cita os parágrafos por número (§).

**Evidência** (fora do repo, só leitura): `/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/ab-lab/leitura-concorrentes/` — `replay-23-10.csv`, `rotulos-23-10.md`, `replay-resultado-mistas-hist-23-10.md`, `prototipo/replay_v2_mistas_hist.py`, `yannis-export-replay.sql`. Abaixo, `$EV` = essa pasta.

## Restrições globais

- Worktree **`/Users/figueiredo/Workspace/bt-leitura`**, branch `trabalho/leitura-concorrentes`. Nada fora dele.
- **Sem migration.** Sonda, watch e banco não mudam (§1, §12). As colunas usadas já existem: `yt_watch_readings.titulo_exibido`, `idioma`, `rodada_id`; `competitor_videos.competitor_channel_id`; `notifications.dedup_key`/`expired_at`.
- Flag `OBS_TROCAS_CONCORRENTE` (só `'on'` liga; `flag.ts` não muda). O envio A vai com ela **off**.
- Nenhuma tarefa faz push, deploy, seed em produção nem `db:push` (o controlador cuida).
- Constantes do spec, com estes valores: `OBS_REGRA_VERSAO = 2`, `W_RODADAS = 8`, `MIN_RODADAS_TITULO = 6`, `MIN_RODADAS_MINIATURA = 4`, `SPAN_MAX_H = 72`, `FRESCOR_H = 9`, `MIN_RODADAS_MISTAS_HIST = 2`, `ALFA = 0.0005`, `Q_TRAVA = 0.999`, `PERIODO_MIN_RODADAS = 16`, `CARENCIA_H = 24`, `TETO_VERSOES = 8`, `APRENDENDO_DIAS = 4`, `JANELA_DIAS = 30`, `DHASH_MIN_TROCA = 10`, `TETO_ITERACOES_GUARDA = 3`, `TETO_LINHAS_GUARDA = 1000`, `LIMIAR_SEM_TITULO = 0.20`, `LIMIAR_ALVOS_SEM_LEITURA = 0.10`.
- `PADROES_DETECCAO`, `classificarTitulo` e as fixtures do próprio canal ficam **intocados** (§3.3).
- Textos ao dono: os do §11 e do §6.1, **copiados sem reescrever**. "teste" vem sempre com "possível", nunca "venceu", e a contagem é em passagens, nunca em %.
- Testes: `// @vitest-environment node` em todo arquivo novo. Relógio relativo ou fixo, nunca ano futuro hardcoded no meio da lógica (regra anti-regressão). A fixture real é de 23/10/2026 e usa a data dela.
- Saída de teste sempre para arquivo; no contexto, só `tail`. Nenhum comando espera mais de 4 min em primeiro plano.
- `pureza.test.ts` do observador lista os arquivos do diretório: todo arquivo novo em `observados/` entra na lista dele (puro) ou no `SERVIDOR` (I/O).
- Commits: `tipo: descrição curta` + `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. `--no-verify` só se o hook falhar por arquivo de outro terminal (memória do dono); o typecheck web tem de passar.

## Preparação do worktree (uma vez, antes da T1)

O worktree não tem `node_modules`. Em background, com saída em arquivo:

```bash
cd /Users/figueiredo/Workspace/bt-leitura && (npm ci && npm run build:packages) > /tmp/leitura-prep.log 2>&1; echo FIM >> /tmp/leitura-prep.log
```

Pronto quando `tail -3 /tmp/leitura-prep.log` mostrar `FIM` sem `ERR!`. Para conferir: `cd apps/web && npx vitest run test/youtube/teste-youtube/observados > /tmp/leitura-base.log 2>&1; tail -5 /tmp/leitura-base.log` mostra a suíte atual verde.

## Decisões do plano (o spec deixa abertas; a revisão pode recusar)

- **D-P1. `ficou.transicao`.** O spec (§11, Troca) pede "entre 20/10 13h e 19h", e a forma de `ficou` do §4 não carrega esse intervalo. Os dois campos ganham `transicao: { antes: string; de: string; ate: string } | null`, em que `de` é a última vista de Y e `ate` é a 1ª rodada de X depois disso. É JSON aditivo, sem migration, e entra no teste de < 4 KB.
- **D-P2. `sem_troca_vista.desde`.** O cursor não guarda o início de W. `desde = avaliadoEm − (W_RODADAS − 1) × 6 h`, e o texto mostra só o dia ("desde 21/10"). O acoplamento com a cadência é o mesmo do §3.2.
- **D-P3. Alvo que saiu não emite linha.** `passo.ts` não faz upsert de observado quando `a.saiuEm !== null`; grava só o cursor. Sem isso, um alvo que sai com rodada fresca reabriria a linha que a varredura acabou de fechar (§4, última linha da tabela).
- **D-P4. Leitura do idioma majoritário.** O protótipo não filtra o idioma. Rodei a cópia com o filtro do §3.1 (`maioria`, empate para o mais recente) sobre o mesmo CSV: **0 divergências em 35, contagens iguais** (título EA 14, EA_SUMINDO 3, NM 22, SEM 137). O replay em TS pode exigir os mesmos valores do protótipo.
- **D-P5. Resumo do envio B.** A linha de resumo (§7, Envio B, 1) conta vídeos **pelo título**. A miniatura entra numa 2ª linha: "Miniatura: Z trocas, K alternando sem dar para afirmar troca."
- **D-P6. Rota do envio B.** `GET /api/pipeline/youtube/competitors/observed`, ação MCP `get_observed`. O caminho `/competitors/` já liga o endpoint à tool `youtube_observatory` em `auto-register.ts`.

## Chave por pessoa (§7, Envio B): conferido no código, **o caminho não existe hoje**

- Existe a **criação** da chave por pessoa: perfil `observatorio_leitura`, colunas `user_id` e `expires_at` em `pipeline_api_keys` (migration `20261014000003`), o comando do dono `apps/web/scripts/observatorio-acesso.ts criar --usuario <e-mail>`, e `acesso-ia/{porta,registrar,taxa}.ts`.
- Essa chave, porém, **não lê nada**. Em `/api/pipeline/*` ela leva 403 sempre (`lib/pipeline/auth.ts:98`). Em `/api/mcp` também, porque a permissão dela não inclui `read` (`app/api/mcp/route.ts:33`, `mcpRequirePermission`). O 2º servidor, o da tool `observatorio_leitura` (`lib/pipeline/mcp/observatorio/servidor.ts`, `registrarServidorDoObservatorio`), **não está montado em rota nenhuma**, e o `responder` que ele espera (o da "Tarefa 10") não existe no código.
- **Consequência, pelo §7:** "Se não existir, o B espera; a chave permanente nunca é usada no Claude Code." O envio B fica atrás do **portão B0**.
- **Minha recomendação:** escrever B1 e B2 agora e promovê-los com A. Custa ~75K tokens e não tem risco de dado, porque é só leitura e segue a flag. O Cowork ganha a leitura já, com a chave dele. A metade "mesmo número no Claude Code" (§8.3, Envio B pronto) fica **não cumprida** até o servidor do perfil ser montado, numa frente própria, que hoje não tem plano.
- **Do outro lado:** segurar B inteiro, como diz o texto do spec, custa uma promoção a mais depois (um build) e deixa o Cowork sem a leitura até lá.
- A Hanna não foi consultada neste r1; a decisão é do dono ou do controlador.

---

## Mapa de arquivos

`O/` = `apps/web/src/lib/youtube/teste-youtube/observados/`, `TO/` = `apps/web/test/youtube/teste-youtube/observados/`.

| Arquivo | Envio | Papel |
|---|---|---|
| `O/inferir.ts` (reescrito) | A | regra v2 pura, tipos `Observado` por campo, `ficou` tipado |
| `O/guarda.ts` (novo, puro) | A | placeholder: decisão por achados, `titulosSuspensos`, laço de até 3 iterações |
| `O/alarme.ts` (novo, puro) | A | dia BRT anterior, condições 1–3 do §6.1, textos do aviso |
| `O/estado-de-leitura.ts` (reescrito) | A | `EstadoTitulo`/`EstadoMiniatura` e a ordem 1–9 do §5 |
| `O/textos.ts` (novo, puro) | A | textos do §11 |
| `O/ensaio.ts` (novo, puro) | A | carregador do export/fixture + `ensaiar` (replay da CI e ensaio a seco) |
| `O/avisos.ts` (novo, servidor) | A | I/O do alarme e do aviso da guarda |
| `O/passo.ts` | A | `select`, `agora` único, guarda com I/O, contadores, `> 0`, D-P3 |
| `apps/web/src/lib/youtube/agenda/tarefas/avisos-pendentes.ts` | A | parte nova `leitura` em `DepsAvisos` |
| `apps/web/scripts/obs-dry-run.ts` + `obs-dry-run.sql` (novos) | A | ensaio a seco (§8.0) |
| `TO/fixtures/replay-23-10.json` (novo) | A | recorte de 35 alvos |
| `apps/web/src/lib/pipeline/services/leitura-concorrentes.ts` (novo) | B | função única da rota e do MCP |
| `apps/web/src/app/api/pipeline/youtube/competitors/observed/route.ts` (novo) | B | `GET` |
| `api-registry.ts`, `leitura-rotas.ts`, `mcp/tools.ts`, `mcp/services/youtube-observatory.ts`, `data/pipeline-docs/cowork-docs-youtube.md` | B | Pipeline Integrity + ação MCP |

## Ordem e custo

| # | Tarefa | Depende de | Tokens (executor Sonnet) |
|---|---|---|---|
| T1 | Fixture + carregador | prep | ~30K |
| T2 | Regra v2 do título + replay dos 35 | T1 | ~65K |
| T3 | Miniatura v2 + gravação (`Observado`, `trocas`, `ficou`) | T2 | ~50K |
| T4 | Simulação com semente + contrato `classificarTitulo` | T2 | ~35K |
| T5 | Guarda pura | T3 | ~30K |
| T6 | `passo.ts` | T3, T5 | ~55K |
| T7 | `estadoDeLeitura` por campo | T3 | ~45K |
| T8 | Textos do §11 | T7 | ~25K |
| T9 | Alarme e aviso da guarda | T5 | ~55K |
| T10 | Ensaio a seco | T6, T8 | ~35K |
| T11 | Fecho do envio A | todas | ~15K |
| B0 | Portão: decisão sobre a chave por pessoa | — | — |
| B1 | Serviço + rota + registro | T8, B0 | ~45K |
| B2 | Ação MCP + doc do Cowork | B1 | ~30K |

Total: A ≈ 440K, B ≈ 75K. T4 e T7 podem correr em paralelo com T5/T6 (arquivos disjuntos). As demais vão em sequência.

## Foco de revisão (o spec implica, nenhum teste de tarefa cobriria sozinho)

1. **Limite exato do frescor.** Na regra, a última rodada de W vale se `agoraMs − tUltima < 9 h`. Na leitura, o alvo cai para `sem_leitura` se `agoraMs − ultimaRodadaEm > frescorMs`. Os dois lados da borda (8 h 59 e 9 h 01) têm teste (T2, T7).
2. **Mesma versão com textos brutos diferentes** (NFC × NFD, espaço invisível). A versão é a chave normalizada, mas a guarda consulta **cada** texto bruto dela. Um placeholder que aparece com dois brutos é pego pelos dois (T5, T6).
3. **Virada do dia em São Paulo.** O dia D do alarme vai de 03:00Z a 03:00Z. Uma leitura às 02:59Z do dia seguinte é de D, e uma às 03:00Z não é (T9).
4. **Histórico longo.** Um alvo com 120 rodadas e 8 versões (fim da janela de 30 d) avalia em < 50 ms (O(R²·v), §3.3), para não estourar o disparo (T2).
5. **Placeholder só no passado.** Uma versão suspensa que existiu apenas na última janela de teste, fora de W, nunca aparece em `trocas` nem em `ficou` (T6, semente D+3).

---

### T1: Fixture do replay e carregador

**Arquivos**
- Criar: `TO/fixtures/replay-23-10.json`, `O/ensaio.ts` (só o carregador nesta tarefa), `TO/ensaio-carregador.test.ts`.
- Modificar: `TO/pureza.test.ts` (lista passa a incluir `ensaio.ts`).

**Interfaces**
- Produz:
  ```ts
  export interface LinhaExport { yt: string; rodada_id: string; lida_em: string; http: number | null; erro: string | null; jogador_bloqueado: boolean; idioma: string | null; titulo_exibido: string | null; thumb_http: number | null; dhash: string | null; variante: string | null; largura: number | null; altura: number | null; publicado_em: string | null; canal?: string | null }
  export interface FixtureColunar { fonte: string; colunas: (keyof LinhaExport)[]; linhas: unknown[][] }
  export interface AlvoExport { ytId: string; canal: string | null; publicadoEm: Date | null; leituras: LeituraObs[]; thumbsPorId: Map<number, ThumbObs>; rodadas: number; ultimaRodadaEm: string | null }
  export function linhasDaFixture(f: FixtureColunar): LinhaExport[]
  export function extrairLinhas(texto: string): LinhaExport[]   // JSON de array de linhas OU [{ json_agg: [...] }] (saída do `supabase db query`)
  export function isoDoBanco(s: string): string                 // '2026-10-19 01:20:55.353+00' -> '2026-10-19T01:20:55.353Z'
  export function carregarExport(linhas: readonly LinhaExport[]): Map<string, AlvoExport>
  ```
  `carregarExport` cria um `ThumbObs` sintético por linha com `thumb_http` não nulo (`id` = índice da linha) e liga `miniaturaId` a ele. `LeituraObs` já sai no formato da T2: `tituloExibido` no lugar de `tituloOficial`/`tituloFonte`. Nesta tarefa, declare o novo `LeituraObs` em `inferir.ts` sem mexer na regra.

- [ ] **Passo 1: gerar a fixture.** Os 35 ids são os 25 de `$EV/rotulos-23-10.md` mais os 10 de título único sorteados no `replay-resultado-mistas-hist-23-10.md`: `YXfydW4tLAU G-Hyv6lQG0c g0W5cPmkWKM 3kH2Mq6kE6E 5LrOAfgIdw4 teMVb72ZMB8 A-lHdxsfYCE dgFKO2dyYhc z9uCiPIfKb0 3vyzSTWAxno`. Use `python3 -I` com o módulo `csv` (os títulos têm vírgula). A saída é colunar, nas colunas de `LinhaExport` sem `canal`. Converter: `'NULL'` e `''` viram `null`; `http`, `thumb_http`, `largura` e `altura` viram int; `jogador_bloqueado` vira bool; `lida_em` e `publicado_em` passam por `isoDoBanco`. `rodada_id` vira `r<n>`, na ordem da 1ª aparição. `fonte` = `"replay-23-10.csv, 35 alvos (25 rotulados + 10 de título único), 1841 leituras"`. JSON compacto, sem indentação. Conferir: 1841 linhas, 35 ids distintos, maior `lida_em` = `2026-10-23T17:40:58.820Z`, arquivo < 400 KB.
- [ ] **Passo 2: teste que falha** (`ensaio-carregador.test.ts`):
  - `isoDoBanco('2026-10-19 01:20:55.353+00') === '2026-10-19T01:20:55.353Z'`;
  - a fixture carregada tem 35 alvos e 1841 leituras;
  - `2emVR-6NEmM` tem `publicadoEm` não nulo e `rodadas` igual ao número de `rodada_id` distintos;
  - toda leitura com `thumb_http` tem `thumbsPorId.get(miniaturaId)`;
  - `extrairLinhas` aceita `[{"json_agg":[{...}]}]` e `[{...}]` e devolve o mesmo resultado;
  - texto que não é JSON lança `Error('export ilegível')`.
- [ ] **Passo 3: rodar e ver falhar.** `cd /Users/figueiredo/Workspace/bt-leitura/apps/web && npx vitest run test/youtube/teste-youtube/observados/ensaio-carregador.test.ts > /tmp/leitura-T1.log 2>&1; tail -20 /tmp/leitura-T1.log`. Esperado: FAIL (módulo ausente).
- [ ] **Passo 4: implementar** `ensaio.ts` (o carregador) e o novo `LeituraObs`. Ajustar `fabrica.ts`: `tituloExibido: 'Titulo A'` no lugar de `tituloOficial`/`tituloFonte`. Os testes da v1 que quebrarem com isso só serão reescritos na T2/T3; nesta tarefa, marque `describe.skip` com o comentário `// v1: reescrito na T2/T3`.
- [ ] **Passo 5: rodar e ver passar** (mesmo comando, mais `test/youtube/teste-youtube/observados/pureza.test.ts`). Esperado: PASS.
- [ ] **Passo 6: commit.** `git add apps/web/src/lib/youtube/teste-youtube/observados/ensaio.ts apps/web/src/lib/youtube/teste-youtube/observados/inferir.ts apps/web/test/youtube/teste-youtube/observados/{fixtures/replay-23-10.json,ensaio-carregador.test.ts,fabrica.ts,pureza.test.ts,inferir.test.ts}` e depois `git commit -m "test: fixture do replay de 23/10 (35 alvos) e carregador do export"`.

**Pronto quando** a fixture está no repo com < 400 KB e o carregador está verde.

---

### T2: Regra v2 do título (§3.1–§3.6) e replay dos 35

**Arquivos**
- Modificar: `O/inferir.ts` (núcleo novo; a montagem de `Observado` é da T3).
- Testes: `TO/regra-v2.test.ts` (novo), `TO/replay.test.ts` (novo).

**Interfaces**
- Consome: `LeituraObs`, `carregarExport` (T1).
- Produz:
  ```ts
  export interface Rodada { tMs: number; rodadaId: string; versoes: ReadonlySet<string> }   // tMs = menor lida_em válida da rodada
  export type EstadoRegra = 'em_andamento' | 'sumindo' | 'terminou' | 'troca' | 'indeterminada' | 'sem_troca_vista' | 'nao_medido'
  export interface Decisao { estado: EstadoRegra; w: Rodada[]; x: string | null; s: string[]; sumidas: string[]; janelaTeste: Rodada[] | null; antes: string | null; mistasHist: number }
  export function rodadasDoTitulo(ls: readonly LeituraObs[], suspensos?: ReadonlySet<string>): { rodadas: Rodada[]; brutos: Map<string, Set<string>> }
  export function qualificadas(janela: readonly Rodada[]): Set<string>                 // vista em >= 2 rodadas da janela
  export function rodadasMistas(hist: readonly Rodada[], q: ReadonlySet<string>): number
  export function rodadasExigidas(q: number): number                                   // ceil(ln ALFA / ln(1 - min(q, Q_TRAVA)))
  export function decidirCampo(campo: CampoObs, rodadas: readonly Rodada[], o: { publicadoMs: number; agoraMs: number }): Decisao
  ```
  Mapa para o protótipo: `EA`→`em_andamento`, `EA_SUMINDO`→`sumindo`, `TERM`→`terminou`, `TROCA`→`troca`, `SEM`→`sem_troca_vista`, `NM`→`nao_medido`, `INDET`→`indeterminada`.

**Algoritmo** (porte fiel de `avalia`, `decide_unica`, `ultima_janela_teste`, `periodo` e `ausencia_ok` do protótipo, com as diferenças do spec):
- Validade do título: §3.1. Só vota o idioma majoritário (`maioria`, empate para o mais recente). Chaves em `suspensos` contam como leitura inválida.
- `W = rs.slice(-8)`, `W₋₁ = rs.slice(-9, -1)`, `W⁻ = rs.slice(-16, -8)` filtrada por `tMs >= publicadoMs + 24 h`.
- W precisa do mínimo de rodadas, de um span ≤ 72 h e de `agoraMs − W.at(-1).tMs < 9 h`; senão, `nao_medido`.
- É teste se `qualificadas(W).size >= 2` e `rodadasMistas(rs, q) >= 2`. Senão, `qualificadas(W).size !== 1` → `nao_medido`. Com X único: se `W₋₁.length < min` ou `qualificadas(W₋₁)` ≠ {X}, `nao_medido`.
- A última janela de teste percorre `e` de `rs.length` até 8, com `w = rs[e-8:e]` e histórico `rs[:e]`. O título com S ≠ {X} usa q sobre `periodo(rs, Y)` (16 rodadas no mínimo) e R = rodadas desde a última com Y. Todas cumprem → `terminou`; senão, `sumindo`.
- Sem janela de teste (ou na miniatura), vale W⁻ depois da carência. Abaixo do mínimo, `nao_medido`; `{X}` → `sem_troca_vista`; `{Y}` com R cumprido (q sobre W⁻) → `troca` com `antes = Y`; miniatura com qualificada ≠ X sem cumprir R → `indeterminada`; resto → `nao_medido`.
- No título, teste vira `em_andamento`; na miniatura, `indeterminada` (§3.4).

- [ ] **Passo 1: testes que falham** em `regra-v2.test.ts`. Usar o fabricante `rodadas()` de `fabrica.ts`, que monta 3 passadas a cada 6 h, e um título por letra (`tituloExibido: 'Titulo ' + letra`):
  - `rodadasExigidas(1) === 2` (trava), `rodadasExigidas(0.5) === 11`, `rodadasExigidas(0.2) === 35`;
  - **troca limpa A→B**, avaliada a cada rodada da 21ª à 40ª, com 20 rodadas de A e depois B: nenhum estado `em_andamento`; o 1º `troca` sai **7 rodadas** depois da troca; antes dele só `sem_troca_vista`/`nao_medido`;
  - **Y em 100% de W⁻ e 1 blip de Y em W:** nunca `troca` enquanto R < 2;
  - **Y em todas as rodadas do período** (q = 1): `rodadasExigidas` dá 2, sem `-Infinity`/`NaN`;
  - **teste A/B seguido de troca manual para C:** 12 rodadas alternando A/B, depois 16 de C: `terminou`, com `x = 'Titulo C'` e `sumidas = ['Titulo A', 'Titulo B']`;
  - **2 idiomas:** maioria `pt` com 2 títulos e minoria `en` com um 3º: o 3º não vota. No empate 9×9, vale o idioma da leitura mais recente;
  - **frescor (foco 1):** última rodada a 8 h 59 min → medido; a 9 h 01 min → `nao_medido`;
  - **span:** 8 rodadas espalhadas em 73 h → `nao_medido`;
  - **custo (foco 4):** 120 rodadas, 8 versões alternando → `decidirCampo` em < 50 ms (`performance.now()`).
- [ ] **Passo 2: replay** em `replay.test.ts`. Carregar a fixture, `agoraMs` = maior `lida_em`, `publicadoMs` de cada alvo. Esperado **exato** (saída do protótipo, `replay-resultado-mistas-hist-23-10.md` §2):

  | estado | alvos |
  |---|---|
  | `em_andamento` | 2emVR-6NEmM, FxP6Yzehs3k, KdCouw4w7uA, rh4LfKilm6s, NsYd2UAN2AA, ADECP7e1kjE, 0thg8eunUto, lnPfS9BCC_M, Y6pJEbktw7Y, pilQupJKe2o, TtjDltoXhqI, vzD6swtayKk, kY4nm1gdXwg, bY2q7zTwep4, DUj-F_Ff2Aw |
  | `sumindo` | AKKb2Oz77fw, xQcKF7hVts0, iqTrdmtqCCg |
  | `sem_troca_vista` | 6MYeq9cWCT8, 50b-VZ_PJZU, hm7FwmxfHp4, wr_NzNbKDVY + os 10 de título único |
  | `nao_medido` | Tk_0L_vS5Y4, 8fi8uOPOJA8, ZdJe2woz0jY |

  Também: nenhum dos 10 de título único dá `em_andamento`, `sumindo`, `terminou` ou `troca`. Uma divergência **não se resolve mexendo em limiar**: pare e devolva ao controlador com o alvo, o esperado e o obtido.
- [ ] **Passo 3: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/regra-v2.test.ts test/youtube/teste-youtube/observados/replay.test.ts > /tmp/leitura-T2.log 2>&1; tail -30 /tmp/leitura-T2.log`.
- [ ] **Passo 4: implementar** as funções acima em `inferir.ts`. Remover da regra o que é só da v1 (`corridas`, `corridaCabivel`, `ESTAVEL_*`, `MIN_PASSADAS_INICIAL`, `TETO_CORRIDAS`, `TETO_BYTES_CORRIDA`, `VALIDAS_MIN_MEDIDO`). `versoesDeMiniatura` e `maioria` ficam.
- [ ] **Passo 5: rodar e ver passar** (mesmo comando). Esperado: PASS, 0 divergências.
- [ ] **Passo 6: commit** com `feat: regra v2 do título dos concorrentes (rodadas, janelas, mistas no histórico) e replay de 23/10`.

**Pronto quando** o replay dá 35/35 e as sementes do §9.2 de regra estão verdes.

---

### T3: Miniatura v2 e gravação (§3.7, §4)

**Arquivos**
- Modificar: `O/inferir.ts`.
- Testes: reescrever `TO/inferir.test.ts`, onde ficam os testes da v1 que ainda valem (validade da miniatura, placeholder 120×90, variante dominante, Hamming) e os novos.

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
  export function inferirObservadoDetalhe(e: EntradaObs): ResultadoObs
  export function montarObservado(campo: CampoObs, veredito: string, ...): Observado   // lança Error('miniatura nunca é possivel_teste_youtube') (§3.7)
  ```
  - Mapa estado → linha: a tabela do §4. `sem_troca_vista`, `nao_medido` e `indeterminada` com menos de 2 componentes qualificados → **nenhuma linha**.
  - "Versão do alvo" é a que tem 2 rodadas com ela a ≤ 7 rodadas de distância, ou seja, qualificada em alguma janela de 8. `trocas` segue a ordem da 1ª vista; acima de 8 versões, ficam as 8 com `ultima_vista` mais recente, `nVersoes` = total real, `versoes_omitidas = n − 8` e `versoesDemais = true`.
  - `ficou.titulo` é X em `terminou`/`troca`; em `em_andamento`/`sumindo`, é a versão com mais rodadas em W (empate: `ultima_vista` mais recente). `ref` e `titulo` cortam em 300 caracteres. `janela_teste` vem de W em `em_andamento`/`sumindo`, da última janela de teste em `terminou`, e é `null` no resto.
  - `primeiraTrocaEm` é a `primeira_vista` da 2ª versão em ordem de 1ª vista, no histórico inteiro.
  - `validasTitulo`/`validasMiniatura` = `w.length`, ou 0 quando o estado é `nao_medido` (§4, Cursor).
  - `versoesTitulo` traz **todas** as versões do alvo no título (não só as 8), com os textos brutos, para a guarda (§6.2, "Quais versões").
  - `indeterminadas` conta os pares consecutivos com Hamming entre 7 e 9, como hoje (§3.7, mudança pequena).

- [ ] **Passo 1: testes que falham** (`inferir.test.ts`):
  - **invariantes (§9.6):** a miniatura nunca sai `possivel_teste_youtube` (A/B de miniatura alternando dá `troca_observada` + `em_andamento` + `alternada`); o título nunca sai `troca_observada` + `em_andamento`; `montarObservado('miniatura', 'possivel_teste_youtube', …)` lança;
  - `Buffer.byteLength(JSON.stringify(ficou)) < 4096` com 8 versões de 300 caracteres;
  - 9 versões gravam 8 em `trocas`, com `nVersoes === 9`, `ficou.versoes_omitidas === 1`, `versoesDemais === true` e estado decidido por W;
  - `primeiraTrocaEm` igual em duas chamadas seguidas com `agoraMs` diferente;
  - **Hamming 8** (`DH_A`→`DH_C` estável por 16 rodadas): 0 observados, `indeterminadas > 0`, `validasMiniatura > 0`;
  - troca de miniatura `DH_A`→`DH_B` limpa: 1 linha `troca_observada`/`estavel`/`sequencial`, com `ficou.transicao.antes === DH_A`;
  - teste de título → linha `possivel_teste_youtube`/`em_andamento`/`alternada`, `ficou.mistas_hist === true`, `ficou.versoes[*].rodadas_em_w` somando as rodadas de W.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/inferir.test.ts > /tmp/leitura-T3.log 2>&1; tail -30 /tmp/leitura-T3.log`.
- [ ] **Passo 3: implementar** a montagem e `OBS_REGRA_VERSAO = 2`. `inferirObservado(e)` continua como atalho de `inferirObservadoDetalhe(e).observados`.
- [ ] **Passo 4: rodar e ver passar.** Mesmo comando, mais `replay.test.ts` e `regra-v2.test.ts`. Esperado: PASS.
- [ ] **Passo 5: commit** com `feat: gravação da regra v2 (ficou por campo, teto de 8 versões, invariantes da miniatura)`.

**Pronto quando** os invariantes do §9.6 passam e nenhuma linha emitida tem `nVersoes < 2`.

---

### T4: Simulação com semente e contrato com `classificarTitulo` (§9.3, §9.4)

**Arquivos**
- Testes novos: `TO/simulacao.test.ts`, `TO/contrato-classificar.test.ts`.

**Interfaces**
- Consome: `decidirCampo`, `Rodada` (T2); `carregarExport` (T1); `classificarTitulo` (`teste-youtube/titulo.ts`), `resolverOpcoes` (`tipos.ts`), `prepararLeituras` (`preparar.ts`), todos sem mudança.

- [ ] **Passo 1: `simulacao.test.ts`.** `mulberry32(seed)` local ao teste, com semente 2023. Para pesos 80/20 e 90/10: 1.000 alvos, 40 rodadas de 3 leituras sorteadas, avaliação **só na 40ª**. Afirmar que a fração de `terminou`/`troca` é < 0,01 nos dois pesos, e que o teste inteiro roda em < 5 s (`performance.now()`). Não comparar com os números do Python (§9.3).
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
- Consome: `inferirObservadoDetalhe`, `EntradaObs`, `VersaoParaConferir`, `ResultadoObs` (T3).
- Produz:
  ```ts
  export interface Achado { ytId: string }
  export function ehPlaceholder(achados: readonly Achado[], o: { canalDoAlvo: string | null; canalDe: (ytId: string) => string | null; bateuTeto: boolean }): boolean
     // dedup no cliente; true se bateuTeto, ou >= 2 vídeos distintos, ou >= 1 vídeo de canal diferente do alvo
  export type ConferirVersoes = (vs: readonly VersaoParaConferir[]) => Promise<ReadonlySet<string>>   // devolve as chaves suspensas
  export interface ResultadoGuardado { r: ResultadoObs; suspensos: ReadonlySet<string>; estourou: boolean; iteracoes: number }
  export async function inferirComGuarda(e: EntradaObs, conferir: ConferirVersoes, teto = TETO_ITERACOES_GUARDA): Promise<ResultadoGuardado>
  export function titulosSuspensos(leituras: readonly { ytId: string; canal: string | null; tituloExibido: string | null }[]): string[]   // normalizado em >= 3 vídeos, ou >= 2 vídeos de canais distintos
  ```
  - `inferirComGuarda` só confere quando há linha de título a emitir. Cada versão é conferida uma vez só (`Set` das já conferidas). Uma versão suspensa entra em `titulosSuspensos` e a regra roda de novo. Se, no teto, ainda houver versão nova não conferida, sai com `estourou = true`, sem observado de título e com `validasTitulo = 0`.

- [ ] **Passo 1: testes que falham:**
  - `ehPlaceholder`: 1 outro vídeo do mesmo canal → false (**caso `Lolzin`**); 2 outros vídeos do mesmo canal → true; 1 vídeo de outro canal → true; 1500 achados do mesmo vídeo + 1 de outro, com `bateuTeto` → true; 1500 achados do mesmo vídeo sem teto → false;
  - `inferirComGuarda`: um placeholder P alternando com o título real em 5 rodadas faz a 1ª saída ser `em_andamento` com P. P é suspenso, a 2ª iteração dá `sem_troca_vista` e não há observado de título;
  - re-execução que cita versão nova não conferida chama `conferir` de novo, só com a nova;
  - um `conferir` que suspende sempre a versão nova mais recente estoura em 3 iterações: `estourou`, 0 observados de título, `validasTitulo === 0`;
  - **foco 2:** a versão com brutos `'Título'` (NFC) e `'Título'` (NFD) chega a `conferir` com os dois brutos;
  - `titulosSuspensos`: o mesmo título em 3 vídeos de 1 canal → suspenso; em 2 vídeos de 2 canais → suspenso; em 2 vídeos de 1 canal → não.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/guarda.test.ts > /tmp/leitura-T5.log 2>&1; tail -30 /tmp/leitura-T5.log`.
- [ ] **Passo 3: implementar** `guarda.ts`.
- [ ] **Passo 4: rodar e ver passar** (mesmo comando, mais `pureza.test.ts`).
- [ ] **Passo 5: commit** com `feat: guarda de título repetido (placeholder) da leitura dos concorrentes`.

---

### T6: `passo.ts` (§4 reavaliação e cursor, §6.2 com I/O)

**Arquivos**
- Modificar: `O/passo.ts`, `TO/passo.test.ts`.

**Interfaces**
- Consome: `inferirComGuarda`, `ehPlaceholder` (T5); `Observado` (T3).
- Muda:
  - `select` das leituras: `'id,rodada_id,lida_em,http,erro,jogador_bloqueado,idioma,titulo_exibido,miniatura_id'`;
  - `publicacoes()` devolve `{ publicado: Map<string, string | null>; canalDe: Map<string, string> }`, com a chave `chaveAlvo(site, yt)` e o valor `competitor_channel_id`;
  - `avaliar()` captura `const agoraMs = c.agora()` **uma vez** no topo e o usa em `inferir`, `ultima_atualizacao_em` e `avaliado_em`;
  - a função `conferir` real, por versão e por texto bruto: `yt_watch_readings.select('youtube_video_id').in('youtube_video_id', <lote de 100 ids de alvos concorrentes do site>).neq('youtube_video_id', alvo).eq('titulo_exibido', bruto).gte('lida_em', primeira − 24 h).lte('lida_em', ultima + 24 h).limit(1000)`, e o teto é `data.length === 1000`;
  - contadores novos: `obs_titulo_suspenso` (versões suspensas mais estouros) e `obs_versoes_demais`;
  - `obs_sem_leitura_valida++` quando `validasTitulo === 0 || validasMiniatura === 0`;
  - D-P3: com `a.saiuEm !== null`, nada de upsert de observado; só o cursor.

- [ ] **Passo 1: testes que falham** (`passo.test.ts`, adaptando `mundo()` para leituras com `titulo_exibido` e `jogador_bloqueado: true`):
  - **relógio que avança** (`contexto(sb, T0, 1000)`): a linha tem `ultima_atualizacao_em === avaliado_em` do cursor;
  - teste de título → 1 linha `possivel_teste_youtube`, cursor com `validas_titulo > 0`;
  - **placeholder P em 5 vídeos, em 2 rodadas na virada do dia:** avaliado em D+1 e em D+3 (relógio relativo à fixture do mundo), dá 0 linhas com P em `trocas` nas duas vezes e `obs_titulo_suspenso > 0`. É o foco 5;
  - **`Lolzin`** (2 vídeos do mesmo canal com o mesmo título, cada um alternando com o próprio título) → as linhas saem, sem suspensão;
  - **1000+ leituras do placeholder num vídeo e 1 num 2º** → suspende;
  - **Hamming 8:** 0 linhas, cursor gravado, `obs_falhou === 0`;
  - alvo com `saiu_em` e rodada fresca → 0 upserts em `ab_native_observados`, cursor gravado;
  - `sem_troca_vista` depois de uma troca já gravada → a linha anterior fica intocada (mesmo `ultima_atualizacao_em`) e o cursor anda;
  - flag off → nada lido (já existe; manter).
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/passo.test.ts test/youtube/teste-youtube/observados/registrador.test.ts > /tmp/leitura-T6.log 2>&1; tail -30 /tmp/leitura-T6.log`.
- [ ] **Passo 3: implementar.** A consulta da guarda passa por `ida(c, fim)` antes de cada ida ao banco. Os lotes de ids saem dos alvos de `tipo = 'concorrente'` do mesmo site, inclusive os que saíram.
- [ ] **Passo 4: rodar e ver passar** (mesmo comando). Depois, a pasta inteira: `npx vitest run test/youtube/teste-youtube/observados > /tmp/leitura-T6b.log 2>&1; tail -8 /tmp/leitura-T6b.log`.
- [ ] **Passo 5: commit** com `feat: passo do observador com título exibido, guarda por versão e agora único por avaliação`.

**Pronto quando** a pasta `observados` está verde e `npx tsc --noEmit -p apps/web` não acusa nada em `observados/` (saída para `/tmp/leitura-T6-tsc.log`, mostrando só as linhas com `observados`).

---

### T7: `estadoDeLeitura` por campo (§5, §9.5)

**Arquivos**
- Reescrever: `O/estado-de-leitura.ts`, `TO/estado-de-leitura.test.ts`.

**Interfaces**
- Consome: `FicouTitulo`, `FicouMiniatura`, `VersaoObs` (T3); `modoTrocasConcorrente` (`flag.ts`), só no teste.
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
  export const FRESCOR_MS: number   // FRESCOR_H * 3_600_000, o valor que serviço e ensaio usam
  ```
  - `ficou` e `trocas` chegam do banco como `unknown`. Cada função valida a forma com guardas de tipo locais, sem Zod, para continuar pura. Forma inválida ou `versaoRegra < 2` vale linha ausente (§4, v1).
  - Ordem: passos 1–9 do §5, literalmente. `sem_troca_vista.desde` segue D-P2; `troca.entre` vem de `ficou.transicao`, e `vistoAte` de `alvo.ultimaRodadaEm`.
  - `RODADAS_MIN_MEDIDO`, `estadosDeLeitura`, `lerEstadosDeLeitura` e `ConsultaEstado` da v1 saem. Não há consumidor fora da pasta (conferido com grep).

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
  - troca não atual → `troca`, com `vistoAte`;
  - linha `versaoRegra: 1` → tratada como ausente (`sem_troca_vista`);
  - cursor fora de dia (`avaliadoAteRodada < rodadas − 1` e avaliado há > 9 h) → `sem_leitura`.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/estado-de-leitura.test.ts > /tmp/leitura-T7.log 2>&1; tail -30 /tmp/leitura-T7.log`.
- [ ] **Passo 3: implementar.**
- [ ] **Passo 4: rodar e ver passar** (mesmo comando, mais `pureza.test.ts`).
- [ ] **Passo 5: commit** com `feat: estado de leitura por campo da regra v2 (tabela-verdade do §5)`.

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
  - Textos literais do §11, preenchidos pelo estado. "há N dias" = `floor((agoraMs − última vista)/86.400.000)`. As versões aparecem entre aspas simples, no máximo 80 caracteres cada (79 + "…").
  - `trocaConferida` é sempre `false` até o §8.2 provar (quem chama passa `false`), e então o texto leva `AINDA_NAO_CONFERIDA`.

- [ ] **Passo 1: testes que falham.** Um por estado do §11, com igualdade **exata**:
  - em andamento com 3 títulos (5/8, 3/8, …);
  - sumindo;
  - provavelmente terminou, com 1 e com 2 sumidas;
  - troca, com e sem conferida;
  - sem troca vista;
  - cada motivo de não medido, e o "Não medido agora (…). Último estado visto até 23/10: …";
  - fora da janela;
  - os 3 da miniatura (troca, indeterminada, sem troca vista).
  
  Mais estes:
  - `quando('2026-10-22T13:00:00Z') === '22/10 10h'`;
  - nenhum texto contém `venceu` nem `%`;
  - todo texto com "teste" contém "possível" ou "Possível".
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/textos.test.ts > /tmp/leitura-T8.log 2>&1; tail -30 /tmp/leitura-T8.log`.
- [ ] **Passo 3: implementar.**
- [ ] **Passo 4: rodar e ver passar** (mesmo comando, mais `pureza.test.ts`).
- [ ] **Passo 5: commit** com `feat: textos da leitura dos concorrentes (§11)`.

---

### T9: Alarme de degradação e aviso da guarda (§6.1, §6.2 Aviso)

**Arquivos**
- Criar: `O/alarme.ts` (puro), `O/avisos.ts` (servidor), `TO/alarme.test.ts`, `TO/avisos.test.ts`.
- Modificar: `apps/web/src/lib/youtube/agenda/tarefas/avisos-pendentes.ts`; `apps/web/test/youtube/agenda/avisos-pendentes.test.ts` (o dublê `rodarAvisos` ganha `leitura: async () => RESULTADO_VAZIO`, como `nicho`); `TO/pureza.test.ts` (`alarme.ts` na lista, `avisos.ts` em `SERVIDOR`). Se o `banco-falso` não tiver `like`, acrescentar `q.like` com a semântica `%` do Postgres.

**Interfaces**
- Consome: `titulosSuspensos` (T5), `normalizarTitulo`.
- Produz:
  ```ts
  // alarme.ts
  export interface LeituraDia { ytId: string; rodadaId: string; lidaEm: string; http: number | null; erro: string | null; tituloExibido: string | null; idioma: string | null; canal: string | null }
  export interface AlvoAtivo { ytId: string; publicadoEm: string }
  export function diaBrtAnterior(agoraMs: number): { rotulo: string; inicioMs: number; fimMs: number }   // rotulo 'AAAA-MM-DD'; Intl America/Sao_Paulo
  export type Condicao = 'sem_leitura' | 'sem_titulo' | 'alvos_sem_leitura'
  export interface Avaliacao { dispara: boolean; condicao: Condicao | null; pctSemTitulo: number; alvosSemLeitura: number; alvosConsiderados: number }
  export function avaliarDegradacao(alvos: readonly AlvoAtivo[], leituras: readonly LeituraDia[], dia: { inicioMs: number; fimMs: number }): Avaliacao
     // alvos: ativos e não aprendendo em fimMs (publicação entre 4 e 30 dias); condições 1–3 na ordem do §6.1
  export function textoDegradacao(a: Avaliacao, segundoDia: boolean): string   // textos do §6.1, % arredondado
  export function textoSuspenso(n: number): string                            // texto do §6.2 "Aviso"
  // avisos.ts
  export interface ResultadoLeituraAvisos { ativo: boolean; degradada: number; suspenso: number; expirados: number; falhas: number }
  export async function enviarAvisosDaLeitura(sb: SupabaseClient, agora: Date, o: { semTempo: () => boolean; fanOut?: FanOut; env?: NodeJS.ProcessEnv }): Promise<ResultadoLeituraAvisos>
  ```
  - `avisos.ts`: flag off → `{ ativo: false, … }`, sem ler nada. Por site, monta os alvos ativos (`yt_watch_alvos`, `tipo = 'concorrente'`, `saiu_em is null`, mais a publicação de `competitor_videos`). As leituras de [D−1, D+1) vêm em lotes de 100 ids, nas colunas do §6.1 e paginadas. Avalia D e D−1. Se D dispara, `fanOut({ siteId, domain: 'youtube', type: 'youtube.obs_degradada', priority: 2, title: 'Leitura dos concorrentes degradada', message: textoDegradacao(aD, aDmenos1.dispara), dedupKey: 'obs-degradada:' + rotulo, payload: { condicao }, actionHref: '/cms/youtube/competitors' })`. Se não dispara, expira os `obs-degradada:%` abertos do site (`expired_at`), no padrão de `avisos-pendentes.ts`. O mesmo vale para `titulosSuspensos(leituras de D)`, com `type: 'youtube.obs_titulo_suspenso'` e `dedupKey: 'obs-titulo-suspenso:' + rotulo`. `fan.total === 0` vai ao `Sentry.captureMessage`.
  - `rodarAvisos`: `DepsAvisos.leitura?: (sb, agora, semTempo) => Promise<ResultadoLeituraAvisos>`. A parte roda **depois** da do nicho, em `try/catch` próprio. O detalhe ganha `obs_aviso_degradada`, `obs_aviso_suspenso`, `obs_aviso_expirados` e `obs_aviso_falhou`. Falha dela **não muda** `estado` nem `motivo` (§6.1).

- [ ] **Passo 1: testes que falham.** Em `alarme.test.ts`:
  - `diaBrtAnterior(Date.parse('2026-10-23T12:00:00Z'))` → `rotulo '2026-10-22'`, `inicioMs = 2026-10-22T03:00Z`, `fimMs = 2026-10-23T03:00Z`;
  - **foco 3:** uma leitura às `2026-10-23T02:59Z` está em D, e uma às `03:00Z` não está;
  - **dia sem leitura** com 1 alvo ativo → `sem_leitura`;
  - leitura `http 200`, sem erro e sem título, entra nos 20% (21% → `sem_titulo`; 20% → não);
  - alvos sem rodada válida de título > 10% → `alvos_sem_leitura`;
  - alvo de 31 dias e alvo de 2 dias ficam fora de `alvosConsiderados`;
  - texto do 1º dia e do 2º dia, literais do §6.1;
  - `textoSuspenso(5)` literal.
  
  Em `avisos.test.ts` (banco falso, `fanOut` injetado):
  - parte rodada 2× no mesmo dia → `fanOut` com a mesma `dedupKey` (1 chave);
  - em dois dias seguidos → 2 chaves, e o 2º texto acrescenta "2º dia seguido…";
  - dia abaixo do limiar → `expired_at` gravado nos `obs-degradada:*` abertos;
  - `obs-titulo-suspenso:*` expira no 1º dia sem suspensos;
  - `fan.total === 0` → Sentry chamado;
  - flag off → 0 consultas.
  
  Em `avisos-pendentes.test.ts`: `leitura` que lança → `estado` e `motivo` iguais aos de quando ela não lança, `detalhe.obs_aviso_falhou === 1`, e o lembrete do dia 14 ainda sai.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/alarme.test.ts test/youtube/teste-youtube/observados/avisos.test.ts test/youtube/agenda/avisos-pendentes.test.ts > /tmp/leitura-T9.log 2>&1; tail -30 /tmp/leitura-T9.log`.
- [ ] **Passo 3: implementar.** Conferir se `fanOutToSiteAdminsDetailed` aceita os dois `type` novos. Se houver uma união fechada de tipos de notificação (grep `youtube.native_lembrete` em `src/lib/notifications`), acrescentar os dois ali.
- [ ] **Passo 4: rodar e ver passar** (mesmo comando, mais `pureza.test.ts` e `test/integration/f2-avisos-sino.test.ts`, que pula sem banco local).
- [ ] **Passo 5: commit** com `feat: alarme de degradação e aviso de título suspenso da leitura dos concorrentes`.

---

### T10: Ensaio a seco (§8.0)

**Arquivos**
- Modificar: `O/ensaio.ts` (acrescenta `ensaiar`), `TO/replay.test.ts` (um caso que roda `ensaiar` sobre a fixture).
- Criar: `apps/web/scripts/obs-dry-run.ts`, `apps/web/scripts/obs-dry-run.sql`.

**Interfaces**
- Consome: `carregarExport` (T1), `inferirComGuarda`, `ehPlaceholder` (T5), `estadoTitulo`/`estadoMiniatura` (T7), `textoTitulo`/`textoMiniatura` (T8), `avaliarDegradacao`, `titulosSuspensos`, `diaBrtAnterior` (T9).
- Produz:
  ```ts
  export interface LinhaDoEnsaio { ytId: string; titulo: EstadoTitulo; miniatura: EstadoMiniatura; textoTitulo: string; textoMiniatura: string; suspensos: string[] }
  export interface RelatorioEnsaio { agora: string; alvos: LinhaDoEnsaio[]; cobertura: { elegiveis: number; tituloMedido: number; miniaturaMedida: number; aprendendo: number; foraDaJanela: number }; suspensosDoDia: string[]; degradacao: Avaliacao; contaminacao: number }
  export async function ensaiar(alvos: ReadonlyMap<string, AlvoExport>, o: { agoraMs: number }): Promise<RelatorioEnsaio>
  export function relatorioEmTexto(r: RelatorioEnsaio): string
  ```
  - A `conferir` em memória procura cada bruto nas leituras dos **outros** alvos do export (mesma janela de ± 24 h) e decide com `ehPlaceholder`, usando o `canal` da linha.
  - A linha e o cursor são simulados como o `passo.ts` os gravaria, com `flagLigada: true`.
  - "Elegíveis" (§8.1, 1) são os alvos ativos com ≥ 8 rodadas, menos aprendendo e fora da janela, ambos contados à parte.
  - `contaminacao` conta as versões emitidas vistas em ≥ 2 outros vídeos (§8.1, 2).
- `obs-dry-run.sql`: o `select` de `$EV/yannis-export-replay.sql` + a coluna `(select v.competitor_channel_id from public.competitor_videos v where v.video_id = l.youtube_video_id order by v.published_at limit 1) as canal`, com o filtro `l.lida_em >= now() - interval '31 days'` no lugar da data fixa, embrulhado em `select json_agg(t) from (…) t;`. O cabeçalho em comentário diz que é só leitura e traz o comando do controlador: `npx supabase db query --linked -f apps/web/scripts/obs-dry-run.sql > /tmp/obs-export.json`.
- Script: `cd apps/web && npx tsx --require ./scripts/_sem-server-only.cjs scripts/obs-dry-run.ts <export.json> [--agora <ISO>]`. Lê o arquivo, chama `extrairLinhas`, `carregarExport` e `ensaiar`, e imprime `relatorioEmTexto`. O padrão de `--agora` é a maior `lida_em` do export. **Nada é gravado**: o script não importa cliente Supabase.

- [ ] **Passo 1: teste que falha** em `replay.test.ts`. `ensaiar` sobre a fixture dá `contaminacao === 0` e `cobertura.tituloMedido / cobertura.elegiveis >= 0.9`; cada `textoTitulo` não é vazio; os estados batem com os da T2.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/youtube/teste-youtube/observados/replay.test.ts > /tmp/leitura-T10.log 2>&1; tail -20 /tmp/leitura-T10.log`.
- [ ] **Passo 3: implementar** `ensaiar`, `relatorioEmTexto`, o script e o SQL.
- [ ] **Passo 4: rodar e ver passar.** Depois, o script sobre a fixture: `cd apps/web && npx tsx --require ./scripts/_sem-server-only.cjs scripts/obs-dry-run.ts test/youtube/teste-youtube/observados/fixtures/replay-23-10.json > /tmp/leitura-T10-ensaio.txt 2>&1; head -40 /tmp/leitura-T10-ensaio.txt`. Para o script aceitar a fixture, `extrairLinhas` também reconhece o formato colunar `{ colunas, linhas }`; acrescente esse caso ao teste da T1. Esperado: 35 alvos, o resumo de cobertura e 0 contaminação.
- [ ] **Passo 5: commit** com `feat: ensaio a seco da leitura dos concorrentes (script só de leitura)`.

---

### T11: Fecho do envio A

- [ ] **Passo 1: suíte da área.** `cd /Users/figueiredo/Workspace/bt-leitura/apps/web && npx vitest run test/youtube test/mcp test/lib/pipeline > /tmp/leitura-T11.log 2>&1; grep -E "Test Files|Tests|FAIL" /tmp/leitura-T11.log | head -20`. Esperado: 0 FAIL.
- [ ] **Passo 2: typecheck.** `npx tsc --noEmit > /tmp/leitura-T11-tsc.log 2>&1; tail -5 /tmp/leitura-T11-tsc.log`. Esperado: vazio. Na raiz: `npm run build:packages` não é necessário, porque nada em `packages/` mudou.
- [ ] **Passo 3: nada fora do escopo.** `git diff --stat origin/staging -- apps/web/src/lib/youtube/watch supabase apps/web/src/lib/youtube/teste-youtube/titulo.ts apps/web/src/lib/youtube/teste-youtube/tipos.ts` sai **vazio** (sonda, watch, banco e detector do dono intocados).
- [ ] **Passo 4: data da poda (§7, "conferir a data no plano").** Pela regra de `yt_watch_poda` (`supabase/migrations/20261018000005…`: apaga leituras de alvo com `saiu_em < agora − 30 d`), a 1ª poda do bruto desde 19/10 cai **≈ 18/11/2026**, para os alvos que saíram em 19/10. Ela atinge só alvos já fora da janela. O controlador confirma com `select min(saiu_em) from yt_watch_alvos where tipo = 'concorrente';` (só leitura) e anota no ledger.
- [ ] **Passo 5:** sem commit novo se nada mudou. O relatório ao controlador traz a lista de commits A (T1–T10) e o resultado do Passo 1.

**Pronto quando** a CI local está verde nas pastas tocadas, o replay dá 35/35 e o diff não toca sonda, watch, banco nem detector.

---

### B0: Portão (decisão, não código)

O executor **não** começa B1 sem o registro, no ledger, de uma destas decisões do dono ou do controlador:
- **(a) recomendada:** B1 e B2 agora; a paridade com o Claude Code fica pendente até o servidor do perfil ser montado;
- **(b)** B espera inteiro (texto do spec).

Fatos e custos: seção "Chave por pessoa", acima.

---

### B1: Serviço, rota e registro (Pipeline Integrity)

**Arquivos**
- Criar: `apps/web/src/lib/pipeline/services/leitura-concorrentes.ts`, `apps/web/src/app/api/pipeline/youtube/competitors/observed/route.ts`, `apps/web/test/lib/pipeline/leitura-concorrentes.test.ts`.
- Modificar: `apps/web/src/lib/pipeline/api-registry.ts`, onde entra o endpoint e o `endpoint_count` do YOUTUBE passa de **38 → 39**; `apps/web/src/lib/pipeline/leitura-rotas.ts`, com o padrão `'/api/pipeline/youtube/competitors/observed'` em ordem alfabética.

**Interfaces**
- Consome: `estadoTitulo`, `estadoMiniatura`, `FRESCOR_MS` (T7); `textoTitulo`, `textoMiniatura`, `NOTA_PASSAGENS`, `TEXTO_MOTIVO` (T8); `modoTrocasConcorrente`; `ServiceContext` (`services/types`).
- Produz:
  ```ts
  export interface ItemLeitura { canal: string; canal_id: string; video_id: string; titulo_video: string | null; campo: 'titulo' | 'miniatura'; estado: string; texto: string; visto_ate: string | null }
  export type RespostaLeitura =
    | { ligada: false; motivo: 'flag_off'; resumo: 'Leitura de concorrentes desligada' }
    | { ligada: true; resumo: string; resumo_miniatura: string; nota: string; contagem: { titulo: Record<string, number>; nao_medido_por_motivo: Record<string, number>; miniatura: Record<string, number> }; itens: ItemLeitura[]; janela_dias: 14 }
  export async function lerLeituraDosConcorrentes(ctx: ServiceContext, o: { agoraMs: number; env?: NodeJS.ProcessEnv }): Promise<{ data: RespostaLeitura }>
  ```
  - Lê, só do `ctx.siteId` e com paginação: `yt_watch_alvos` (`tipo = 'concorrente'`), `ab_native_obs_cursor` e `ab_native_observados` (`versao_regra >= 2`) em lotes de 100 ids, e `competitor_videos` com `competitor_channels` (título do vídeo, nome do canal, publicação, canal com `removal_requested_at` ignorado, como em `passo.publicacoes`).
  - Itens: os estados `em_andamento`, `sumindo`/`provavelmente_terminou` e `troca` (título) e `troca`/`indeterminada` (miniatura) com `visto_ate` nos últimos 14 dias. A ordem é `em_andamento` primeiro, depois `visto_ate` decrescente. `sem_troca_vista` e `nao_medido` entram só na contagem.
  - Resumo, literal do §7, em que `(motivos)` = `aprendendo 7, saiu 14`, motivos com 0 omitidos, ordem de `Motivo`. A 2ª linha segue D-P5.
  - Erro de banco vira `PipelineServiceError` (500), nunca uma lista vazia.
- Rota: copiar o formato de `competitors/signals/route.ts`, com `authenticateRead`, `pipelineSuccess(data, 200, auth)` e `serviceErrorToResponse`. `agoraMs = Date.now()` fica na rota, nunca no serviço.
- Registro: `{ method: 'GET', path: '/api/pipeline/youtube/competitors/observed', summary: "Competitor title/thumbnail reading (rule v2): per video 'possible YouTube test' in progress, fading, probably ended, or swap, each with the fixed sentence and seen-until; not-measured only counted, with reason. Off flag answers 'Leitura de concorrentes desligada'", auth: 'read' }`.

- [ ] **Passo 1: testes que falham** (banco falso de `test/youtube/observatorio/sinais/fake-sb` ou o `banco-falso` do registro):
  - flag off (com `delete process.env.OBS_TROCAS_CONCORRENTE` e sem `env`) → `{ ligada: false, motivo: 'flag_off' }`, **sem** `itens`;
  - flag on com 3 alvos (teste, troca e aprendendo) → `resumo === '3 vídeos de concorrentes observados: 1 com possível teste em andamento, 0 provavelmente terminados, 1 trocas, 1 não medidos (aprendendo 1)'`, com 2 itens e cada `texto` igual a `textoTitulo(...)`;
  - item com `visto_ate` de 15 dias atrás não entra na lista, mas entra na contagem;
  - linha `versao_regra = 1` é ignorada;
  - erro de banco → lança `PipelineServiceError`;
  - `api-registry.test.ts` e `leitura-rotas.test.ts` existentes, verdes.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/lib/pipeline/leitura-concorrentes.test.ts test/lib/pipeline/api-registry.test.ts test/lib/pipeline/leitura-rotas.test.ts > /tmp/leitura-B1.log 2>&1; tail -30 /tmp/leitura-B1.log`. Se `leitura-rotas.test.ts` morar em outra pasta, achar com `find apps/web -name leitura-rotas.test.ts`.
- [ ] **Passo 3: implementar** o serviço, a rota, o registro e o padrão de rota.
- [ ] **Passo 4: rodar e ver passar** (mesmo comando).
- [ ] **Passo 5: commit** com `feat: GET competitors/observed, leitura dos concorrentes para o Cowork`.

---

### B2: Ação MCP `get_observed` e doc do Cowork

**Arquivos**
- Modificar: `apps/web/src/lib/pipeline/mcp/tools.ts` (`YoutubeObservatoryShape.action` ganha `'get_observed'`, e a descrição ganha a frase abaixo); `apps/web/src/lib/pipeline/mcp/services/youtube-observatory.ts` (o `case 'get_observed'` chama `lerLeituraDosConcorrentes(buildCtx(), { agoraMs: Date.now() })` e devolve sem indentação, como `get_signals`; a mensagem de ação desconhecida lista a nova ação); `apps/web/data/pipeline-docs/cowork-docs-youtube.md` (seção `### GET /api/pipeline/youtube/competitors/observed` depois de `signals/:id/dismiss`).
- Testes: `apps/web/test/mcp/youtube-observatory-observed.test.ts` (novo); os existentes `youtube-mcp-tools.test.ts`, `youtube-observatory-parametros.test.ts` e `youtube-cowork-docs-observatorio.test.ts`.

**Interfaces**
- Consome: `lerLeituraDosConcorrentes` (B1). `PARAMETROS_LIDOS` não muda, porque a ação não tem parâmetro.
- Frase da descrição da ação: `get_observed: competitor title/thumbnail reading. Quote each item's texto as is; never drop "possível"/"provavelmente", never say a version won, "não medido" is never zero nor "did not test", "provavelmente terminou" can reopen. Off flag: say "leitura de concorrentes desligada".`
- Doc do domínio: forma da resposta (os dois ramos de `RespostaLeitura`) e um exemplo curto. Em seguida, a "Regra para o Cowork" do §7, as cinco linhas literais, e a frase "Depois de editar esta doc, rodar de novo o seed da referência do Cowork (controlador)".

- [ ] **Passo 1: teste que falha** (`youtube-observatory-observed.test.ts`, no molde de `youtube-observatory-signals.test.ts`, com `getMcpContext` e `getSupabaseServiceClient` mockados):
  - `youtubeObservatory({ action: 'get_observed' })` com a flag off → texto JSON com `ligada: false`;
  - com a flag on e o mesmo banco falso da B1 → o **mesmo** JSON que `lerLeituraDosConcorrentes` devolve para a rota (paridade rota × MCP pela mesma função);
  - ação desconhecida → a mensagem cita `get_observed`.
- [ ] **Passo 2: rodar e ver falhar.** `npx vitest run test/mcp/youtube-observatory-observed.test.ts test/mcp/youtube-mcp-tools.test.ts test/mcp/youtube-observatory-parametros.test.ts test/mcp/youtube-cowork-docs-observatorio.test.ts > /tmp/leitura-B2.log 2>&1; tail -30 /tmp/leitura-B2.log`.
- [ ] **Passo 3: implementar** a ação e escrever a doc.
- [ ] **Passo 4: rodar e ver passar** (mesmo comando, mais `test/lib/pipeline`).
- [ ] **Passo 5: commit** com `feat: ação get_observed no youtube_observatory e doc do Cowork`.

**Pronto quando** a rota e o MCP devolvem o mesmo JSON para o mesmo banco, a doc tem as cinco regras e os testes de registro, ferramentas e doc estão verdes.

**Depois de B2 (controlador, fora deste plano):** promover, rodar o seed da referência do Cowork (`scripts/seed-pipeline-reference.ts`, que escreve em produção) e conferir pelos dois caminhos (§8.3). O do Claude Code depende de B0.

---

## Cobertura do spec (autoconferência)

| Spec | Tarefa |
|---|---|
| §3.1 validade, idioma, suspenso | T2, T5 |
| §3.2 janela, mínimos, 72 h, frescor | T2 |
| §3.3 caminho (b), contrato | T2, T4 |
| §3.4–§3.5 teste, X único, última janela, R, W⁻ | T2 |
| §3.6 taxas | T4 |
| §3.7 miniatura, Hamming 7–9, proibição | T3 |
| §3.8 aprendendo, fora da janela | T7, T10 |
| §4 tabela, invariantes, `trocas`, teto 8, `ficou`, `primeira_troca_em`, `agora` único, cursor `> 0` | T3, T6 |
| §5 tipos e ordem 1–9 | T7 |
| §6.1 alarme | T9 |
| §6.2 guarda e aviso | T5, T6, T9 |
| §7 envio A / flag / envio B / chave | T1–T11, B0–B2 |
| §8.0 ensaio a seco | T10 |
| §8.1–§8.2 critérios | controlador e Gio; T10 dá a cobertura e a contaminação |
| §9.1–§9.6 | T2 (9.1, 9.2 de regra), T3 (9.6), T4 (9.3, 9.4), T5/T6 (9.2 da guarda), T7 (9.5), T9 (9.2 do alarme) |
| §11 textos | T8 |
