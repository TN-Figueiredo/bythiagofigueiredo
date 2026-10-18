# Teste do YouTube S0 + S1 + S3: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans, tarefa a tarefa. Passos com checkbox (`- [ ]`).

**Objetivo:** fixture versionada do experimento qIg9a7vqcNo, contrato `LeituraWatch` + Zod, e a regra pura `detectarTesteYoutube` / `inferirDesfecho` / `mesmaImagem`, com C1–C32b em TDD.

**Arquitetura:** lib pura em `apps/web/src/lib/youtube/teste-youtube/` (sem banco, rede, `Date.now()`, `sharp`). Leituras passam por Zod → preparação (ordem determinística, votos, rodadas) → classificação do título (por pares) e da miniatura (por classe `variante|largura×altura`) → junção no veredito. Ninguém chama a lib neste lote (nenhuma rota, migration ou tela).

**Stack:** TypeScript 5 strict, Zod 3 (`apps/web` tem `^3.24.2`), Vitest com `// @vitest-environment node`.

**Spec (fonte; o plano não o reescreve, cita seções):** `docs/superpowers/specs/2026-10-18-teste-youtube-deteccao-design.md` (inclui a **Emenda de 18/10 (A5, conflito do dHash)** no fim). Executor lê o spec inteiro antes da 1ª tarefa.

## Pré-requisito

- **S2 da A5 já está no `staging` remoto (`48db6b72d`).** Antes da T5: `git fetch` e confirmar que `48db6b72d` está no staging local (`git merge-base --is-ancestor 48db6b72d HEAD`); se não estiver, parar e pedir ao controlador (`git pull` só por ele; nunca stash/reset). Existe `apps/web/src/lib/youtube/thumb-hamming.ts` (sem sharp) com `DHASH_MAX_SAME = 6`, `hamming(a, b): number`, `sameThumb(a: string|null|undefined, b: string|null|undefined): boolean` (devolve `true` em `a === b` sem validar hex; o regex de hex tem flag `i`, aceita maiúscula) e `thumbRepresentatives(keys: readonly string[]): Map<string, string>` (âncora: compara só com representantes abertos, guloso pelo 1º; **sem parâmetro de limiar**). `thumb-fingerprint.ts` reexporta dele.
- T1–T4 não dependem disso. T6 e T7 dependem de T5 pela interface (`detectar.ts` precisa da miniatura; `desfecho.ts` chama `detectarTesteYoutube`).
- **Este plano NÃO extrai `hamming`/`DHASH_MAX_SAME` de `thumb-fingerprint.ts`.** Não editar `thumb-fingerprint.ts` nem `thumb-hamming.ts`.

## Restrições globais

- Proibido tocar: `apps/web/src/app/**/actions.ts`, assinaturas de `startAbTest`/`createAbTest`, rotação, `settleOnAir`, drift, avaliação, migrations, telas (portão G0: T19 no ar até o E8).
- Toda a lib sem `sharp`, `@vercel/blob`, `next/*`, Supabase, `Date.now()`, `new Date()` sem argumento. Tempo só de `lidaEm` e de `opts.agora`.
- Comparação de tempo sempre em ms (`Date.parse` uma vez); nunca por texto ISO (§3).
- Nulo = não lido; `""` nunca é ausência (Zod recusa).
- Sem `any`. Arquivos kebab-case. Todo teste novo começa com `// @vitest-environment node`.
- `REGRA_TESTE_YOUTUBE_VERSAO = 1`. Limiares padrão exatamente os do §3/§4.3: `minLeituras 9`, `minVotosPorVariante 2`, `minRodadasMistas 2`, `minJanelaMistaMs 30*60_000`, `minFracaoRodadasMistas 0.4`, `maxDuracaoRodadaMs 10*60_000`, `maxVariantes 3`, `dhashMaxSame DHASH_MAX_SAME (6)`, `quarentenaEscritaMs 60*60_000`, `minLeiturasEstavel 18`, `minJanelaEstavelMs 24*3_600_000`, `maxIdadeColetaMs 48*3_600_000`.
- Fixture: recorte `em ≤ 2026-10-18T17:23:00Z`; arquivos do recorte nunca editados depois (ampliação só por arquivo novo).
- Cada tarefa termina em `git add -- <caminhos explícitos> && git commit -m "…" -- <os mesmos caminhos>` no `staging`, **sem push**. Arquivo novo exige o `git add -- <caminho>` antes (`git commit -- <novo>` sozinho falha com `pathspec did not match`); **nunca `git add -A` nem `git add .`** (há dezenas de não rastreados de outros terminais). Multi-terminal: nunca `git stash`, `reset`, `checkout -- .`. Pre-commit roda typecheck (web+api); packages não são tocados.
- Rodar teste: `cd apps/web && npx vitest run test/youtube/teste-youtube/<arquivo> > /tmp/vt-<arquivo>.log 2>&1; tail -30 /tmp/vt-<arquivo>.log` (no contexto só as falhas). Typecheck: `npm run typecheck -w apps/web 2>&1 | tail -20`.

## Decisões do plano onde o spec deixa escolha ou se contradiz (anotar no relatório ao controlador)

1. **C7 × dado (já corrigido no spec, emenda da rodada 4):** no recorte, as **5** variantes ganham o ETag `"1792341745"` com a mesma imagem. A regra do §4.3 p.7 emite **5** sinais, todos em `2026-10-18T16:42:25.000Z`, **ordenados por `(ms do em, compararCodePoint(variante))`**. O teste afirma o array inteiro (ver T5).
2. **`span_ilegivel` em `EstadoCampoTitulo`** (já no spec): `insuficiente.motivo` ganha `'span_ilegivel'` (aditivo). O controlador manda a linha à A5 ("`EstadoCampoTitulo.insuficiente` ganhou `span_ilegivel`, aditivo") antes do commit de T1; o executor não envia mensagem.
3. **C32 duplicado** (já corrigido no spec): `C32a` (span ilegível) e `C32b` (reexportação).
4. **"Pares aprovados" no span e na fração:** aprovados = pares com `≥ minRodadasMistas` rodadas mistas legíveis em que coexistem **e** `≥ minVotosPorVariante` votos de cada texto (total da janela); o passo `janela_curta` só passa se ≥ 1 aprovado tem janela `≥ minJanelaMistaMs`; daí em diante (atípica já checada antes, contando os pares antes da janela), "pares aprovados" = os que também passaram a janela (um par cuja mistura cabe em < 30 min é a propagação que o limiar descarta: fica fora do span e de `variantes`). `janelaMs` do `janela_curta` = a maior janela entre os pares aprovados.
5. **`mesmaImagem` é invólucro de `sameThumb`, não alias** (spec §4.2 e emenda da rodada 4): `mesmaImagem(a, b, dhashMaxSame?)` valida classe `variante|largura×altura`, hex minúsculo `/^[0-9a-f]{16}$/` (maiúscula e 15 caracteres → `incomparavel`; necessário porque `sameThumb` devolve `true` em `a === b` sem validar) e o cinza do 404 (`hamming(d, IMAGEM_PADRAO_YT) ≤ limiar` → `incomparavel`), e só então delega a `sameThumb`. Com `dhashMaxSame` diferente de `DHASH_MAX_SAME`, compara com `hamming(a, b) <= dhashMaxSame` (mesma fonte). Fonte única do limiar e do `hamming`: `thumb-hamming.ts`.
6. **ISO de saída:** `lidaEm` sai do Zod com milissegundos; `primeiraVista` de C1 é `'2026-10-18T16:42:56.000Z'`.
8. **`estavel_curto` × `depois_ambiguo`** (regra do controlador no spec §4.4 p.7): depois dos ramos 1–6, `v = detectarTesteYoutube(depois, opts)`; `provavel_teste` → `teste_visivel`; `v.estado === 'insuficiente'` ou (`nada_visivel` com `motivo === 'um_valor_so'`) → `estavel_curto`; qualquer outro → `depois_ambiguo`.
7. **Título A exato** (conferido em 18/10 por leitura pública de `videoDetails.title`): `5 - Como somos controlados - Consistência e Compromisso (Part 4)`.

## Review Focus (entradas que o spec implica e nenhum C cobre; cada uma tem teste na tarefa dona)

1. **Leituras com o mesmo `lidaEm` e ordem de entrada diferente em rodadas distintas** devem dar o mesmo veredito: teste `desempate total` em T4a.
2. **Rodada com só 1 leitura votante mista impossível** (1 voto não mistura) e rodada com votos de **renderers discordantes** (não vota): não pode virar mista nem contar votos. Teste em T4a.
3. **Escrita conhecida de campo `'miniatura'`** não põe rodada de título em quarentena. Teste em T4a.
4. **`variantes.titulo` com o `tituloOficial` sendo a variante vista depois** (B oficial, A visto primeiro) ordena o oficial primeiro. Teste em T4b.
5. **Desfecho com `leiturasDepois` todas com `erro`**: `depois_sem_leitura`, nunca `estavel_curto`. Teste em T7.

---

## Estrutura de arquivos

| Caminho | Tarefa | Responsabilidade |
|---|---|---|
| `apps/web/src/lib/youtube/teste-youtube/tipos.ts` | T1 | Contrato §3 + Zod + `validarLeituras` + padrões |
| `apps/web/src/lib/youtube/teste-youtube/normalizar-titulo.ts` | T2 | §4.1 |
| `apps/web/test/fixtures/teste-youtube/qIg9a7vqcNo/{titulos.tsv,sondas.tsv,paginas-watch.tsv,dhash.tsv,README.md,carregar.ts}` | T3 | S0 (§2) |
| `apps/web/src/lib/youtube/teste-youtube/preparar.ts` | T4a | validação, desempate, votos, rodadas, quarentena |
| `apps/web/src/lib/youtube/teste-youtube/titulo.ts` | T4b | classificação do título por pares (§4.3 p.2–5) |
| `apps/web/src/lib/youtube/teste-youtube/dhash.ts` | T5 | só reexporta de `@/lib/youtube/thumb-hamming` |
| `apps/web/src/lib/youtube/teste-youtube/imagem.ts` | T5 | `mesmaImagem`, `IMAGEM_PADRAO_YT`, `classeDe`, `instanteDoEtag` |
| `apps/web/src/lib/youtube/teste-youtube/miniatura.ts` | T5 | §4.3 p.6 e p.7 |
| `apps/web/src/lib/youtube/teste-youtube/detectar.ts` | T6 | §4.3 p.1 e p.8 (junção) |
| `apps/web/src/lib/youtube/teste-youtube/index.ts` | T6 | reexporta a API pública (§8) |
| `apps/web/src/lib/youtube/teste-youtube/desfecho.ts` | T7 | §4.4 |
| `apps/web/test/youtube/teste-youtube/sintetico.ts` | T1 | fábrica de leituras para testes |
| `apps/web/test/youtube/teste-youtube/*.test.ts` | T1–T7 | um arquivo por módulo |

---

### Task 1: Contrato (`tipos.ts`), Zod e fábrica de teste

**Files:**
- Create: `apps/web/src/lib/youtube/teste-youtube/tipos.ts`
- Create: `apps/web/test/youtube/teste-youtube/sintetico.ts`
- Test: `apps/web/test/youtube/teste-youtube/tipos.test.ts`

**Interfaces:**
- Produces: todos os tipos e constantes do §3, copiados literalmente (inclusive comentários de contrato), mais estes nomes aditivos:
  - `EstadoCampoTitulo` com `{ estado: 'insuficiente'; motivo: 'poucas_leituras' | 'janela_curta' | 'span_ilegivel' }` (decisão 2).
  - `type DetalheInsuficiente` = a união do `detalhe` de `insuficiente` no veredito (4 motivos), usada dentro de `VereditoTesteYoutube`.
  - `type MotivoNadaVisivelTitulo = 'um_valor_so' | 'troca_sem_mistura' | 'mistura_isolada' | 'mistura_esparsa' | 'mistura_atipica'`.
  - `type LimiaresDeteccao = Required<Omit<OpcoesDeteccao, 'escritasConhecidas'>> & { escritasConhecidas: ReadonlyArray<EscritaConhecida> }`.
  - `const PADROES_DETECCAO: Omit<LimiaresDeteccao, 'escritasConhecidas' | 'dhashMaxSame'>` com os valores das Restrições globais (o `dhashMaxSame` padrão entra em T5, onde `DHASH_MAX_SAME` existe; até lá `resolverOpcoes` usa o literal `6` com comentário `// T5: trocar por DHASH_MAX_SAME`).
  - `resolverOpcoes(opts?: OpcoesDeteccao): LimiaresDeteccao`.
  - `leituraWatchSchema` (Zod, regras exatas do §3), `validarLeituras(x: unknown[]): { validas: LeituraWatch[]; invalidas: number }`.
- Fábrica (`sintetico.ts`):
  - `VIDEO = 'abcdefghijk'`
  - `leitura(p: { em: string; rodada: string; titulo?: string | null; renderers?: Array<{ renderer: string; texto: string | null }>; idioma?: string | null; origem?: string | null; erro?: string | null; oficial?: string | null; miniaturas?: LeituraWatch['miniaturas']; video?: string }): LeituraWatch` — `titulo` preenche os 3 `RENDERERS_TITULO` com o mesmo texto; padrões `idioma 'pt-BR'`, `origem 'vercel'`, `erro null`, `oficial null`, `miniaturas []`.
  - `rodadas(p: { inicio: string; intervaloMs: number; padroes: string[]; textos: Record<string, string>; passoLeituraMs?: number }): LeituraWatch[]` — rodada `i` começa em `inicio + i*intervaloMs`, `rodadaId 'r'+i`; cada letra do padrão (`'ABB'`) é uma leitura, `passoLeituraMs` padrão 2000.

- [ ] **Step 1: Teste que falha (C19, C27)** em `tipos.test.ts`:
  - `texto: ''` → `leituraWatchSchema.safeParse(...).success === false`
  - miniatura com `dhash: '106068cba7a3c3c8', http: 404` → recusada; com `http: 200, largura: null, altura: null` → recusada; `largura` sem `altura` → recusada
  - `lidaEm: '2026-10-18T16:42:56'` → recusada; `'2026-10-18T16:42:56+00:00'` → `data.lidaEm === '2026-10-18T16:42:56.000Z'`; `'2026-10-18T13:42:56-03:00'` → `'2026-10-18T16:42:56.000Z'`
  - título lido com `idioma: null` → recusada; mesma leitura com `titulosExibidos` todos `texto: null` e `idioma: null` → aceita
  - `erro: 'http_429'` com algum `texto` não nulo → recusada; `erro: 'HTTP 429'` → recusada
  - `youtubeVideoId: 'curto'` → recusada; `dhash: 'ZZ…'` (16 chars não hex) → recusada; 15 chars → recusada
  - C27: `validarLeituras([...três válidas com '+00:00' e fração '.5', uma inválida])` → `{ validas.length: 3, invalidas: 1 }`, e `validas` mantém a ordem de entrada (a ordenação é da regra, não do validador)
  - `resolverOpcoes()` devolve os padrões; `resolverOpcoes({ minLeituras: 61 }).minLeituras === 61`
- [ ] **Step 2:** rodar; esperado FAIL (módulo inexistente).
- [ ] **Step 3:** implementar `tipos.ts` e `sintetico.ts` conforme Interfaces. `lidaEm`: `z.string().datetime({ offset: true }).transform(s => new Date(s).toISOString())`. Refines do §3 como `superRefine` no objeto.
- [ ] **Step 4:** rodar; PASS. Typecheck limpo.
- [ ] **Step 5:** `git add -- apps/web/src/lib/youtube/teste-youtube/tipos.ts apps/web/test/youtube/teste-youtube/sintetico.ts apps/web/test/youtube/teste-youtube/tipos.test.ts && git commit -m "feat: teste-youtube S1, contrato LeituraWatch e Zod" -- apps/web/src/lib/youtube/teste-youtube/tipos.ts apps/web/test/youtube/teste-youtube/sintetico.ts apps/web/test/youtube/teste-youtube/tipos.test.ts`

---

### Task 2: `normalizarTitulo`

**Files:** Create `apps/web/src/lib/youtube/teste-youtube/normalizar-titulo.ts`; Test `apps/web/test/youtube/teste-youtube/normalizar-titulo.test.ts`

**Interfaces:** Produces `normalizarTitulo(s: string): string` e `compararCodePoint(a: string, b: string): number` (ordem por code point, para a chave de desempate).

- [ ] **Step 1: Teste (parte unitária de C15):**
  - `normalizarTitulo('Consistência e Compromisso (Part 4)') === 'Consistência e Compromisso (Part 4)'`
  - espaço duplo, ` `, ` `, tab → um espaço; `'  x  '` → `'x'`
  - `'🔥︎ x'` e `'🔥 x'` iguais; `​`, `﻿`, `⁠` removidos
  - `'👨‍👩‍👧'` preservado (contém `‍`)
  - `'PART 4' !== 'Part 4'` após normalizar; entidade `'&amp;'` permanece `'&amp;'`
  - `compararCodePoint('\u{1F600}', '￿') > 0` (por UTF-16 seria < 0)
- [ ] **Step 2:** FAIL. **Step 3:** implementar na ordem do §4.1. **Step 4:** PASS.
- [ ] **Step 5:** `git add -- <os 2 arquivos> && git commit -m "feat: teste-youtube, normalização de título" -- <os 2 arquivos>`

---

### Task 3: Fixture S0 (recorte, `dhash.tsv`, README, `carregar.ts`)

**Files:** Create em `apps/web/test/fixtures/teste-youtube/qIg9a7vqcNo/`: `titulos.tsv`, `sondas.tsv`, `paginas-watch.tsv`, `dhash.tsv`, `README.md`, `carregar.ts`; Test `apps/web/test/youtube/teste-youtube/fixture.test.ts`

**Interfaces:**
- Consumes: `LeituraWatch`, `validarLeituras` (T1).
- Produces (de `carregar.ts`): `VIDEO_ID = 'qIg9a7vqcNo'`, `TITULO_A` (decisão 7), `TITULO_B = 'Consistência e Compromisso (Part 4)'`, `carregarQIg9(): { leituras: LeituraWatch[]; sondas: LeituraWatch[] }`, `linhasDhash(): Array<{ arquivo: string; sha16: string | null; variante: string; largura: number; altura: number; url: string | null; dhash: string; origem: string }>`.

- [ ] **Step 1: Recorte** (comandos copiados também para o README):
```bash
SRC=$HOME/portao-dhash/nativo-qIg9a7vqcNo
DST=apps/web/test/fixtures/teste-youtube/qIg9a7vqcNo; C=2026-10-18T17:23:00Z
mkdir -p $DST
awk -F'\t' -v c=$C 'NR==1 || $1<=c' $SRC/titulos.tsv > $DST/titulos.tsv          # 121 linhas
awk -F'\t' -v c=$C 'NR==1 || $1<=c' $SRC/sondas.tsv  > $DST/sondas.tsv           # 537 linhas
awk -F'\t' -v c=$C 'NR==1 || ($1<=c && $2=="teste" && $3=="watch")' $SRC/paginas.tsv \
  | sed "s/');\$//" > $DST/paginas-watch.tsv                                      # 361 linhas
wc -l $DST/*.tsv
```
Esperado: 121, 537, 361 (cabeçalho incluso). Diferente → parar e reportar. Depois: `shasum -a 256 $DST/titulos.tsv $DST/sondas.tsv $DST/paginas-watch.tsv` deve dar, nesta ordem, `2921ab92153d55678baef71c371ee1453803767e53cfce0b8be9bb4cdd7ac120`, `cf6bd43e51a6eb97eb2254deb7a97e860c0a8e7c14fa709b169b2173c57d5c8b`, `660526cfdfda081d3266300731d2399329074df564153cd15ada44cd446e15d1` (a fonte só anexa; diferente → a fonte foi editada antes de 17:23: parar e reportar).

- [ ] **Step 2: `dhash.tsv`** com um script descartável no scratchpad (não versionado; o texto dele vai para o README), rodado de `apps/web` com `npx tsx`, que importa `dhashOf` de `src/lib/youtube/thumb-fingerprint.ts` e usa `sharp(bytes).metadata()` para largura/altura. Linhas, colunas `arquivo sha16 variante largura altura url dhash origem` (`-` = nulo):
  - `img/<variante>-<sha16>.jpg` → `origem sonda`, `url -`
  - `img-pag/uN.jpg` → `url` = linha N de `urls-distintas.txt`, `variante` = nome do arquivo da URL, `sha16` = 16 hex do sha256 dos bytes, `origem pagina`. Conferência por partição (o mapeamento uN ↔ linha N é por ordem, sem script gravado, e é inócuo porque o dHash é único dentro de cada classe): linhas 1–4 e 14 → 1280×720; linhas 5–13 → 480×360; dHash `686068cfa7a3a3c6` nas de 1280×720 e `106068cba7a3c3c8` nas de 480×360. Qualquer outra combinação → parar e reportar
  - `para-o-studio/*` → `variante studio-A|studio-B`, `origem studio`
  - 4 linhas `origem sqp-completa-18/10`, copiadas da tabela §2.3 (imagens não guardadas): `arquivo sqp-168x94|sqp-196x110|sqp-336x188|sqp-246x138`, `variante hqdefault`, dimensões e dHash da tabela, `url -`, `sha16 -`
  - Conferir contra §2.3: A `686068cfa7a3a3c6`, B `e9f9e90c1a3a3a9c`, `0e5ef9…` → `106068c9a7a3c3c8`, `967c11…` → `106068cba7a3c3c8`, `20e9aa…` → `400e716969691648`. Divergência → parar. Total de linhas de dados: **35** (15 de `img/`, das quais 5 são o corpo do 404 `20e9aa…` 120×90 que `carregar` nunca usa porque `http ≠ 200`; 14 de `img-pag/`; 2 de `para-o-studio/`; 4 `sqp`).
- [ ] **Step 3: README.md** no padrão de `apps/web/test/fixtures/observatorio/README.md`: origem (`~/portao-dhash/nativo-qIg9a7vqcNo/`, scripts `sondar.sh` e `sondar-paginas.sh`), horário do recorte, comandos dos Steps 1–2, `shasum -a 256` de cada um dos 4 TSV, "NÃO EDITAR: ampliar com `titulos-ate-<data>.tsv`/`sondas-ate-<data>.tsv`", `TITULO_A` exato e como foi conferido, a nota das URLs truncadas antes de `&rs=` (texto do §2.1); a origem escrita como `~/portao-dhash/...`, **nunca** `/Users/<nome>/`; uma linha: "8 URLs da watch (28 miniaturas em 7 leituras) surgiram depois do download de 16:44 e ficaram com `http`/`dhash` nulos de propósito"; "a última volta de sondas foi cortada pelo recorte: 2 de 30"; "mapeamento uN ↔ linha N por ordem de `urls-distintas.txt`, sem script gravado; inócuo porque o dHash é único dentro de cada classe"; "as URLs `…aLzl_8DDgj…` do `sqp` carregam o varint 1792341745 = 2026-10-18T16:42:25Z, o instante do reenvio, de graça: a S4 deve gravar a URL completa".
- [ ] **Step 4: Teste que falha** `fixture.test.ts`:
  - `leituras.length === 60`; rodadas distintas 20, cada uma com 3
  - sequência por rodada (A/B pelo `texto` do 1º renderer) unida por espaço `=== 'ABB AAA BAA ABB ABB BBA BBB BBA AAA BBA BBA BAB AAB AAA BBB AAA AAB BBB ABB AAB'`
  - votos: 29 com `TITULO_A`, 31 com `TITULO_B`; toda leitura tem `tituloOficial === TITULO_A`, `idioma 'pt-BR'`, `origemRede 'mac-casa'`, 3 renderers e 6 miniaturas
  - `validarLeituras([...leituras, ...sondas]).invalidas === 0`
  - sondas: `sondas.length === 17`; `sondas.map(s => s.miniaturas.length)` igual a `[...Array(16).fill(30), 2]` (exato; "≤ 30" deixaria passar agrupamento errado); total de miniaturas 482; só `rotulo teste`; `titulosExibidos: []`; toda miniatura `http 404` com `dhash/largura/altura` nulos; toda `http 200` com dHash
  - `linhasDhash()` contém as 5 conferências do Step 2 e tem exatamente 35 linhas
  - miniaturas das `leituras`: exatamente **28** com `http === null` e `dhash === null`, em **7** leituras (4 cada; blocos k = 5, 15, 17, 21, 33, 46, 49, base 1), e **332** com dHash; toda leitura tem `hqdefault` canônica e `maxresdefault` com dHash (`validasMiniatura` do C1 continua 60)
  - `readdirSync` da pasta da fixture, ordenado, `=== ['README.md','carregar.ts','dhash.tsv','paginas-watch.tsv','sondas.tsv','titulos.tsv']` (nenhuma imagem nem `.DS_Store` entra)
- [ ] **Step 5: Implementar `carregar.ts`** conforme §2.2, com estes pontos fixados:
  - Caminhos por `fileURLToPath(new URL('.', import.meta.url))`; leitura com `readFileSync`; nada de rede.
  - Rodada de leitura da watch: nova quando `em` > 30 s da anterior; `rodadaId 'r'+n`; lança `Error` se não houver 20×3.
  - Miniaturas: `paginas-watch.tsv` em blocos de 6 linhas, bloco k ↔ leitura k; lança se ≠ 360 linhas ou se o `em` do bloco distar > 2 s do `em` da leitura. Cada URL → `dhash.tsv` por `url` (as canônicas sem query casam pela linha `pagina` com essa URL); `host` do URL; `http 200`, `etag null`, `sha16 null`. **URL sem linha em `dhash.tsv`** → miniatura `{ url, host, variante, largura: null, altura: null, http: null, etag: null, sha16: null, dhash: null }` (não buscada); **proibido casar por prefixo do `sqp` ou por "mesma variante"** (gravaria um dHash que ninguém mediu).
  - Sondas (`rotulo teste`): volta nova quando o `em` dista > 30 s da linha anterior; `rodadaId 's'+n`; `lidaEm` = 1ª linha; `url = https://<host>/vi/qIg9a7vqcNo/<variante>.jpg` + (`semcache` ? `'?r=semcache'` : `''`); `etag` sem tratamento (com aspas, como veio; vazio → `null`); `sha16` da linha; `http ≠ 200` → `dhash/largura/altura null`; senão via `dhash.tsv` por `(variante, sha16)` com `origem sonda`.
  - Retorno passa por `validarLeituras` e lança se `invalidas > 0`.
- [ ] **Step 6:** PASS. Typecheck limpo.
- [ ] **Step 7:** commit pelos 6 arquivos da fixture por nome (nunca a pasta: a fonte tem `.jpg` e `.DS_Store`):
```bash
F=apps/web/test/fixtures/teste-youtube/qIg9a7vqcNo
git add -- $F/titulos.tsv $F/sondas.tsv $F/paginas-watch.tsv $F/dhash.tsv $F/README.md $F/carregar.ts apps/web/test/youtube/teste-youtube/fixture.test.ts
git commit -m "test: teste-youtube S0, fixture qIg9a7vqcNo recortada até 17:23 UTC" -- $F/titulos.tsv $F/sondas.tsv $F/paginas-watch.tsv $F/dhash.tsv $F/README.md $F/carregar.ts apps/web/test/youtube/teste-youtube/fixture.test.ts
```

---

### Task 4: Preparação (T4a) e classificação do título (T4b)

**T4 é partida em dois ciclos vermelho-verde, cada um com commit próprio:** **T4a** = `preparar.ts` (desempate, votos, rodadas, longa, quarentena); **T4b** = `titulo.ts` (classificação). Dentro de cada um, escrever e fazer passar **um caso por vez**, na ordem do p.5 para T4b (nao_lido → poucas → um_valor → troca → isolada → atípica → janela → span → fração → provável).

**Files:** Create `preparar.ts`, `titulo.ts` em `apps/web/src/lib/youtube/teste-youtube/`; Test `apps/web/test/youtube/teste-youtube/preparar.test.ts` (T4a), `titulo.test.ts` (T4b)

**Interfaces:**
- Consumes: T1 (tipos, `resolverOpcoes`, `leituraWatchSchema`), T2, T3 (`carregarQIg9`, `TITULO_A`, `TITULO_B`), `sintetico.ts`.
- Produces (`preparar.ts`):
```ts
export interface LeituraPreparada {
  l: LeituraWatch                 // saída do Zod
  ms: number
  chaveRodada: string             // JSON.stringify([rodadaId, idioma, origemRede])
  voto: string | null             // normalizado; null = não vota (§4.3 p.2)
  votoCru: string | null          // texto cru do renderer de menor índice (RENDERERS_TITULO; outros nomes depois, por nome)
  idxRenderer: number             // índice desse renderer (fora da lista: RENDERERS_TITULO.length)
  leuTitulo: boolean              // ≥ 1 renderer com texto (conta em validasTitulo)
  leuMiniatura: boolean           // ≥ 1 miniatura com dhash
  textoCanonico: string           // JSON canônico da leitura (chaves ordenadas): último critério do desempate
}
export interface Preparacao { leituras: LeituraPreparada[]; recebidas: number; invalidas: number; comErro: number }
export function prepararLeituras(entradas: readonly unknown[]): Preparacao      // só sem erro; ordenadas por compararDesempate; lança Error com 2+ youtubeVideoId entre as VÁLIDAS, olhadas ANTES de tirar as com erro (§4.3 p.1)
export function compararDesempate(a: LeituraPreparada, b: LeituraPreparada): number // (ms, chaveRodada, idxRenderer, compararCodePoint(votoCru ?? ''), compararCodePoint(textoCanonico))
export interface Rodada { chave: string; leituras: LeituraPreparada[]; deMs: number; ateMs: number; longa: boolean; emQuarentena: boolean; votos: Map<string, number>; votosValidos: number; mista: boolean }
export function montarRodadas(ls: readonly LeituraPreparada[], o: LimiaresDeteccao): Rodada[] // ordenadas por deMs, depois chave
```
  Desempate: usa `chaveRodada` (não só `rodadaId`: duas leituras no mesmo ms e mesmo `rodadaId` com `idioma` diferente empatariam) e, como último critério, um texto canônico da leitura (`JSON.stringify` da saída do Zod) **calculado uma vez por leitura** (guardado em `LeituraPreparada`, O(N·S) uma vez, S ≈ 2 KB).
  `emQuarentena`: `[deMs, ateMs]` toca `[em − maxDuracaoRodadaMs, em + quarentenaEscritaMs]` de alguma escrita com `campo === 'titulo'`. `mista` = `!longa && !emQuarentena && votos.size ≥ 2`.
- Produces (`titulo.ts`):
```ts
export interface ContagemTitulo { rodadas: number; rodadasLongas: number; rodadasMistasTitulo: number; rodadasEmQuarentena: number; textosDistintosTitulo: number; primeiraMistura: string | null; validasTitulo: number }
export type ResultadoTitulo = { contagem: ContagemTitulo } & (
  | { estado: 'nao_lido' }
  | { estado: 'insuficiente'; detalhe: Exclude<DetalheInsuficiente, { motivo: 'titulo_nao_lido' }> }
  | { estado: 'nada_visivel'; motivo: MotivoNadaVisivelTitulo; valorUnico?: { titulo: string }; janela: { de: string; ate: string } }
  | { estado: 'provavel_teste'; variantes: string[]; proporcao: Record<string, number>; votos: Record<string, number>; primeiraVista: string; ultimaVista: string; janela: { de: string; ate: string } })
export function tituloOficialMaisFrequente(ls: readonly LeituraPreparada[]): string | null // empate: primeiro pela ordem de desempate
export function classificarTitulo(ls: readonly LeituraPreparada[], o: LimiaresDeteccao): ResultadoTitulo
```
  `classificarTitulo` segue a ordem exata do §4.3 p.5, com a decisão 4 para "pares aprovados". Fração: span = rodadas com `deMs` entre o `deMs` da 1ª e o `ateMs` da última rodada mista dos pares aprovados; filtro `!longa && !emQuarentena && votosValidos ≥ 3` no numerador (mistas) e no denominador. `span_ilegivel`: no mesmo span sem filtro, `(longas + emQuarentena) > rodadasSpan / 2`. `variantes`/`votos`/`proporcao` usam como chave o `votoCru` da 1ª leitura (ordem de desempate) de cada texto normalizado; a variante igual (normalizada) a `tituloOficialMaisFrequente` vai primeiro. `janela` = 1ª e última leitura com voto.

- [ ] **Step 1: Testes que falham** (`titulo.test.ts`; helper local `classificar(ls, opts?) = classificarTitulo(prepararLeituras(ls).leituras, resolverOpcoes(opts))`):
  - C1 (parte título): fixture → `provavel_teste`, `variantes = [TITULO_A, TITULO_B]`, `votos = { [A]: 29, [B]: 31 }`, `proporcao[B]` ≈ 0.517 (`toBeCloseTo(31/60, 3)`), `primeiraVista '2026-10-18T16:42:56.000Z'`, `ultimaVista '2026-10-18T17:22:26.000Z'`, `contagem.rodadasMistasTitulo 13`, `rodadasLongas 0`
  - C2: 1ª rodada → `insuficiente`, `detalhe { motivo: 'poucas_leituras', minimo: 9, atual: 3 }`
  - C3: rodadas até a que começa às 17:07:52 → `insuficiente`, `janela_curta`, `variantes` com A e B, `janelaMs: 1_499_000` (16:42:56 → 17:07:55), `minimoMs: 1_800_000`
  - C4: até a que começa às 17:16:10 → `provavel_teste`
  - C5: fixture com `{ minLeituras: 61 }` → `insuficiente`, `poucas_leituras`
  - C10: `rodadas({ intervaloMs: 6h, padroes: [...4×'AAA', ...4×'BBB', ...4×'AAA'] })` → `nada_visivel`, `troca_sem_mistura`
  - C10b: 120 rodadas a cada 6 h com padrão explícito: `AAA` e `BBB` alternados por rodada (rodadas homogêneas) e `'AAB'` em 1 a cada 25 → `nada_visivel`, `mistura_esparsa` (com rodadas a cada 6 h, "alternar a cada 3 h" veria sempre a mesma fase; o padrão explícito testa o que o caso descreve)
  - C11: 6 rodadas `AAA`, 1 `ABB`, 6 `BBB` → `mistura_isolada`
  - C15 (integração): fixture com metade dos votos B em NFD, outros com ` ` → mesmo veredito de C1 e `variantes[1]` é o texto cru da 1ª leitura B; troca de `'Part 4'` por `'PART 4'` em metade das B → 3 textos distintos
  - C16: rodadas `A(pt-BR) A(pt-BR) X(en)` × 6 → nenhuma rodada mista (`rodadasMistasTitulo 0`)
  - C17: 4 títulos com cada par coexistindo em ≥ 2 rodadas (padrões `'ABCD'`-like de 4 leituras, 4 rodadas, 30 min de span+) → `mistura_atipica`
  - C24: escritas nossas (campo `'titulo'`) em D0 00:00 (→B), D1 00:00 (→A), D2 00:00 (→B); rodadas a cada 12 h começando 10 min depois de cada escrita: `ABB`, `BBB`, `AAB`, `AAA`, `ABB` (mistas só logo após a escrita; fração 3/5 = 0,6); com `escritasConhecidas` → `nada_visivel`; sem → `provavel_teste`
  - C25: A→B no dia 2 e B→C no dia 20, uma rodada mista em cada → `mistura_isolada`
  - C26 (12 votos, para passar de `minLeituras 9` e chegar à rodada): D1 08:00 rodada normal `AAA`; D1 rodada `x` com leituras 10:00 A, 10:01 A, 16:00 B; D2 rodada `y` igual (10:00 A, 10:01 A, 16:00 B); D2 20:00 `BBB`. Esperado `contagem.rodadasLongas 2`, `rodadasMistasTitulo 0`, `nada_visivel/troca_sem_mistura`. (Sem `!longa` em `mista` seriam 2 mistas, janela > 30 min, fração 2/2 → `provavel_teste`: o mutante morre.)
  - C28: escrita às 10:00, rodada com leituras 09:58, 10:00, 10:02 (A, B, B) → afirmar sobre `montarRodadas(...)[0]`: com escrita `emQuarentena true` e `mista false`; sem escrita `mista true` (3 votos dão `poucas_leituras` no estado de qualquer jeito, por isso a asserção é na rodada)
  - C29 em três construções (rodadas a cada 6 h; M = mista de 3 votos `AAB`/`ABB`; H = homogênea de 3; m2 = mista de 2 votos `AB`; h2 = homogênea de 2 votos; L = longa):
    1. `M H H m2 m2 H H M` → correto 2/6 = 0,33 → `nada_visivel`, `mistura_esparsa`; o mutante "numerador sem filtro de ≥ 3 votos" daria 4/6 → `provavel_teste` (morre)
    2. `M h2 h2 h2 h2 M` → correto 2/2 → `provavel_teste`; o mutante "denominador sem filtro" daria 2/6 → `mistura_esparsa` (morre)
    3. `M H L L L M` (3 longas, span 6, 3 não é > 3: sem `span_ilegivel`) → correto 2/3 → `provavel_teste`; o mutante "longa no denominador" daria 2/6 → `mistura_esparsa` (morre)
  - D4 (decisão 4 do plano): par A–B com mistas a cada 6 h por 2 dias (aprovado) + par A–C com 2 rodadas mistas a 5 min uma da outra → `provavel_teste`, `variantes [A, B]` (C fora), `primeiraVista`/`ultimaVista` e span só do A–B
  - C30: 5 rodadas a cada 6 h `ABC`, `AAA`, `BBB`, `CCC`, `ABC` → os 3 pares aprovados com 2 mistas cada, span de 5 rodadas, fração 2/5 = 0,4 → `provavel_teste` com 3 variantes; a mesma série com uma 6ª rodada homogênea entre as mistas → `mistura_esparsa`
  - C32a: rodadas mistas `AAB` às 00:00 e `ABB` às 12:00 (dia 1), 4 rodadas longas no meio (02:00/04:00/06:00/08:00, leituras em t e t+15 min, A e A) → `insuficiente`, `detalhe.motivo 'span_ilegivel'`, `contagem.rodadasLongas 4`
  - Review Focus 1: fixture com `lidaEm` de duas rodadas trocadas na entrada → igualdade profunda
  - Review Focus 2: leitura com renderers `A`, `B`, `A` → `voto null`, conta em `validasTitulo`; rodada `[discordante, A, B…]` só mistura pelos votos válidos
  - Review Focus 3: escrita com `campo: 'miniatura'` → C28 continua mista (afirmar sobre `montarRodadas(...)[0].mista`)
  - M3: duas leituras no mesmo ms e mesmo `rodadaId`, `idioma` diferente, em ordens trocadas na entrada → mesma ordem após `prepararLeituras`
  - M8: entrada com duas leituras válidas de `youtubeVideoId` diferentes, uma delas com `erro` → **lança** (o lançamento olha as válidas antes de tirar as com erro)
  - Review Focus 4: C1 com `tituloOficial = TITULO_B` em todas → `variantes[0] === TITULO_B`
  - C21 (parte título): fixture embaralhada (semente fixa, Fisher–Yates com LCG no teste) → igualdade profunda; duas leituras no mesmo segundo B em NFC e NFD em ordens trocadas → mesmo `votoCru` escolhido; `…56.500Z` antes de `…57Z` e depois de `…56Z`
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** implementar. **T4a primeiro**: `preparar.ts` com os testes que só dependem dele (C16, parte de ordem de C21, Review Focus 1–3, M3, M8, e C26/C28 sobre `montarRodadas`), PASS e commit T4a. **Depois T4b**: `titulo.ts` conforme §4.3 p.1–5, um caso por vez. Agrupamentos por `Map`; nada quadrático em N (§6).
- [ ] **Step 4:** PASS; typecheck limpo.
- [ ] **Step 5 (dois commits):**
  - T4a: `git add -- apps/web/src/lib/youtube/teste-youtube/preparar.ts apps/web/test/youtube/teste-youtube/preparar.test.ts && git commit -m "feat: teste-youtube S3, preparação das leituras (desempate, rodadas, quarentena)" -- <os mesmos 2>` (os testes de T4a ficam em `preparar.test.ts`, os de T4b em `titulo.test.ts`)
  - T4b: `git add -- apps/web/src/lib/youtube/teste-youtube/titulo.ts apps/web/test/youtube/teste-youtube/titulo.test.ts && git commit -m "feat: teste-youtube S3, regra do título por pares" -- <os mesmos 2>`

---

### Task 5: dHash, `mesmaImagem` e miniatura (antes: `git fetch` e confirmar `48db6b72d` no staging local)

**Files:** Create `dhash.ts`, `imagem.ts`, `miniatura.ts` em `apps/web/src/lib/youtube/teste-youtube/`; Modify `tipos.ts` (padrão `dhashMaxSame = DHASH_MAX_SAME`); Test `apps/web/test/youtube/teste-youtube/imagem.test.ts`, `miniatura.test.ts`

**Interfaces:**
- Consumes: `@/lib/youtube/thumb-hamming` (`hamming(a, b): number`, `DHASH_MAX_SAME`, `sameThumb(a, b): boolean`, `thumbRepresentatives(keys: readonly string[]): Map<string, string>`), T1, T3, T4a (`LeituraPreparada`, `compararDesempate`).
- Produces:
  - `dhash.ts`: `export { hamming, DHASH_MAX_SAME, sameThumb, thumbRepresentatives } from '@/lib/youtube/thumb-hamming'` e nada mais.
  - `imagem.ts`: `IMAGEM_PADRAO_YT = '400e716969691648'`; `mesmaImagem(a: ImagemComparavel, b: ImagemComparavel, dhashMaxSame?: number): ComparacaoImagem` (invólucro de `sameThumb`, decisão 5); `classeDe(m: ImagemComparavel): string | null` (`'<variante>|<largura>x<altura>'`, null com dimensão nula); `instanteDoEtag(etag: string | null): string | null` (tira `W/` e aspas; `/^\d{9,11}$/` e > 0 → ISO de `Number(v)*1000`; senão null).
  - `miniatura.ts`: `classificarMiniatura(ls: readonly LeituraPreparada[], o: LimiaresDeteccao): { estado: EstadoCampoMiniatura; validasMiniatura: number }`; `sinaisFracos(ls: readonly LeituraPreparada[], o: LimiaresDeteccao): SinalFraco[]`, **ordenados por `(Date.parse(em), compararCodePoint(variante))`** (os 5 sinais empatam em `em`; sem o desempate a ordem seguiria a das miniaturas dentro da leitura).
  - Agrupamento da miniatura em `miniatura.ts`: com `o.dhashMaxSame === DHASH_MAX_SAME` → `thumbRepresentatives` (por classe, chaves já filtradas e na ordem de desempate); com outro valor → guloso local de 6 linhas (compara só com representantes abertos) sobre `mesmaImagem(…, o.dhashMaxSame)`, porque `thumbRepresentatives` não recebe limiar.

- [ ] **Step 0: reconferir** que `thumb-hamming.ts` do staging local é o da `48db6b72d` (assinaturas na seção Pré-requisito; **já é âncora**, igual ao §4.3 p.6: compara só com representantes abertos, `seen.push` só ao abrir grupo). Se divergir, anotar no commit e no relatório. `mesmaImagem` valida hex minúsculo **antes** de chamar `sameThumb` (que devolve `true` em `a === b` sem validar e usa regex com flag `i`).
- [ ] **Step 1: Testes que falham** (`imagem.test.ts`):
  - C9: `hqdefault 480×360` `106068c9a7a3c3c8` × `106068cba7a3c3c8` → `mesma`; A × B (`686068cfa7a3a3c6` × `e9f9e90c1a3a3a9c`, mesma classe) → `diferente`; `hqdefault` × `maxresdefault` → `incomparavel`; `hqdefault 480×360` × `hqdefault 336×188` → `incomparavel`; `largura null` → `incomparavel`; `'zzzzzzzzzzzzzzzz'` e 15 chars → `incomparavel`; par a exatamente 6 bits → `mesma`, a 7 → `diferente` (construir trocando bits de `0000000000000000`); limiar custom: `mesmaImagem(a, b, 3)` com 4 bits → `diferente`; hex maiúsculo (`'106068CBA7A3C3C8'`) → `incomparavel`
  - C8 (unidade): `{ dhash: '400e716969691648' }` contra qualquer → `incomparavel`
  - C32b: `import * as tf from '@/lib/youtube/thumb-fingerprint'`, `import * as th from '@/lib/youtube/thumb-hamming'`, `import * as d from '@/lib/youtube/teste-youtube/dhash'` → `tf.hamming === th.hamming`, `d.hamming === th.hamming`, `tf.DHASH_MAX_SAME === 6`, `d.DHASH_MAX_SAME === 6` (este teste importa `thumb-fingerprint`, que puxa sharp: fica neste arquivo de teste, nunca na lib)
  - `instanteDoEtag('"1792341745"') === '2026-10-18T16:42:25.000Z'`; `'"0"'`, `null`, `'"abc"'` → null
- [ ] **Step 2: Testes que falham** (`miniatura.test.ts`, via `prepararLeituras` + `resolverOpcoes`):
  - C6: sondas da fixture → `estado { estado: 'nada_visivel', motivo: 'um_valor_so' }`; `0e5e…` e `967c…` no mesmo grupo
  - C7: `expect(sinaisFracos(sondas)).toEqual(['hq720','hqdefault','maxresdefault','mqdefault','sddefault'].map(v => ({ tipo: 'reenvio_mesma_imagem', em: '2026-10-18T16:42:25.000Z', variante: v })))` (length 5, nenhum com `em < '2026-10-18'`, sondas `http 404` não contam); repetir com as sondas embaralhadas **e com as miniaturas de cada sonda embaralhadas** (mesma semente) → igual
  - C8: sondas `http 404` não votam; uma sonda forçada com `dhash '400e716969691648', http 200, largura 480, altura 360` em `hqdefault` → estado continua `um_valor_so`
  - C22: 9 leituras em 3 rodadas, cada uma com as 5 entradas `hqdefault` (480×360 `106068cba7a3c3c8` e as 4 `sqp` da tabela §2.3) → `um_valor_so`
  - C23: dois dHash a 30 bits em `hqdefault|480x360` alternando em 3 rodadas por 2 h, ≥ 2 votos cada → `miniatura_variou`
  - I6 (limiar custom): dois dHash a 4 bits na mesma classe, ≥ 2 votos cada → padrão: `um_valor_so`; `{ dhashMaxSame: 3 }`: `miniatura_variou`
  - Equivalência (condição a da A5): com `dhashMaxSame: 6` explícito (laço guloso local forçado, em um gancho de teste) e com o padrão (`thumbRepresentatives`), o agrupamento é o mesmo em entrada embaralhada (C21) e nas 5 entradas do C22; sem isso o ramo local deriva calado
  - dedupe: uma leitura com o mesmo dHash em 2 hosts conta 1 voto (`minVotosPorVariante` não é cumprido por ela só)
  - nenhuma leitura com miniatura → `nao_lido`; `validasMiniatura < 9` → `insuficiente`, `poucas_leituras`
- [ ] **Step 3:** implementar (se o agrupamento exigir `thumbRepresentatives` com `sameThumb` fixo em 6, só usar com o limiar padrão); trocar o literal 6 de `resolverOpcoes` por `DHASH_MAX_SAME` (import de `./dhash`).
- [ ] **Step 4:** PASS; typecheck limpo.
- [ ] **Step 5:** `git add -- apps/web/src/lib/youtube/teste-youtube/dhash.ts apps/web/src/lib/youtube/teste-youtube/imagem.ts apps/web/src/lib/youtube/teste-youtube/miniatura.ts apps/web/src/lib/youtube/teste-youtube/tipos.ts apps/web/test/youtube/teste-youtube/imagem.test.ts apps/web/test/youtube/teste-youtube/miniatura.test.ts && git commit -m "feat: teste-youtube S3, mesmaImagem por classe e miniatura (sobre thumb-hamming da S2)" -- apps/web/src/lib/youtube/teste-youtube/dhash.ts apps/web/src/lib/youtube/teste-youtube/imagem.ts apps/web/src/lib/youtube/teste-youtube/miniatura.ts apps/web/src/lib/youtube/teste-youtube/tipos.ts apps/web/test/youtube/teste-youtube/imagem.test.ts apps/web/test/youtube/teste-youtube/miniatura.test.ts`

---

### Task 6: `detectarTesteYoutube` (junção) e `index.ts`

**Files:** Create `detectar.ts`, `index.ts`; Test `apps/web/test/youtube/teste-youtube/detectar.test.ts`, `pureza.test.ts`

**Interfaces:**
- Consumes: T4a (`prepararLeituras`, `montarRodadas`), T4b (`classificarTitulo`, `tituloOficialMaisFrequente`), T5 (`classificarMiniatura`, `sinaisFracos`).
- Produces: `detectarTesteYoutube(leituras: readonly LeituraWatch[], opts?: OpcoesDeteccao): VereditoTesteYoutube` (aceita entrada não validada em tempo de execução: passa tudo por `prepararLeituras`). `index.ts` reexporta: tipos e constantes de `tipos.ts`, `leituraWatchSchema`, `validarLeituras`, `RENDERERS_TITULO`, `REGRA_TESTE_YOUTUBE_VERSAO`, `normalizarTitulo`, `mesmaImagem`, `IMAGEM_PADRAO_YT`, `detectarTesteYoutube`, `inferirDesfecho` (acrescentado em T7).

Junção exatamente como o §4.3 p.8; `contagem` = `recebidas/invalidas/comErro` da preparação + `validasMiniatura` + `ContagemTitulo`; `versaoRegra = REGRA_TESTE_YOUTUBE_VERSAO`; `porCampo.titulo` derivado do `ResultadoTitulo` (sem os campos extras).

- [ ] **Step 1: Testes que falham** (`detectar.test.ts`):
  - C1 completo: além da parte título, `estado 'provavel_teste'`, `campos ['titulo']`, `porCampo.miniatura.estado 'nada_visivel'`, `versaoRegra 1`, `tituloOficial TITULO_A`, `contagem.recebidas 60`
  - C6: `detectarTesteYoutube(sondas)` → `estado 'insuficiente'`, `detalhe { motivo: 'titulo_nao_lido' }`, `porCampo.miniatura { nada_visivel, um_valor_so }`
  - C7 integrado: o `sinaisFracos` do veredito de C6 tem os 5 sinais exatos do T5; estado igual ao de C6
  - C3 integrado não muda; `contagem.rodadas`/`rodadasLongas` somam o que T4a calcula
  - C12: fixture com `videoPrimaryInfoRenderer.texto = null` → mesmo veredito de C1 exceto nada; 3 renderers nulos → `insuficiente`, `titulo_nao_lido`, `contagem.validasTitulo 0`, `porCampo.miniatura.estado 'nada_visivel'`; 3 nulos e `miniaturas: []` → `sem_leitura`
  - C13: fixture + 20 leituras `erro 'http_429'` (sem título, sem dHash) → igual a C1 salvo `contagem.comErro 20` e `recebidas 80`; só as 20 → `sem_leitura`
  - C18: uma leitura de `VIDEO` e outra de `'zzzzzzzzzzz'` → `toThrow(Error)`
  - C19 (fim): fixture + 1 leitura com `texto ''` → igual a C1 salvo `invalidas 1`, `recebidas 61`
  - lista vazia → `sem_leitura`, contagem zerada
  - C21: fixture + sondas embaralhadas → `toEqual` ao não embaralhado
- [ ] **Step 2: Teste de pureza (C20)** `pureza.test.ts`: para cada `.ts` de `src/lib/youtube/teste-youtube/` e para `src/lib/youtube/thumb-hamming.ts`, ler o texto e afirmar que nenhuma linha `import`/`export … from` cita `sharp`, `@vercel/blob`, `next/`, `supabase`, nem `thumb-fingerprint`; e nenhum `Date.now(` nem `new Date()` sem argumento.
- [ ] **Step 3:** FAIL. **Step 4:** implementar. **Step 5:** PASS; typecheck limpo.
- [ ] **Step 6:** `git add -- apps/web/src/lib/youtube/teste-youtube/detectar.ts apps/web/src/lib/youtube/teste-youtube/index.ts apps/web/test/youtube/teste-youtube/detectar.test.ts apps/web/test/youtube/teste-youtube/pureza.test.ts && git commit -m "feat: teste-youtube S3, detectarTesteYoutube e índice público" -- apps/web/src/lib/youtube/teste-youtube/detectar.ts apps/web/src/lib/youtube/teste-youtube/index.ts apps/web/test/youtube/teste-youtube/detectar.test.ts apps/web/test/youtube/teste-youtube/pureza.test.ts`

---

### Task 7: `inferirDesfecho`

**Files:** Create `apps/web/src/lib/youtube/teste-youtube/desfecho.ts`; Modify `index.ts` (reexportar); Test `apps/web/test/youtube/teste-youtube/desfecho.test.ts`

**Interfaces:**
- Consumes: T4a (`prepararLeituras`, `compararDesempate`), T6 (`detectarTesteYoutube`), `normalizarTitulo`.
- Produces: `inferirDesfecho(antes: VereditoTesteYoutube, leiturasDepois: readonly LeituraWatch[], opts: OpcoesDesfecho): Desfecho`. `opts.agora` obrigatório no tipo; em tempo de execução, ausente ou inválido → `throw new Error`, **validado no topo, antes do ramo 1** (senão `inferirDesfecho(antes, [], {})` devolveria `depois_sem_leitura` sem lançar). Ramos na ordem do §4.4 (1–7); `versaoRegra` em todos. Ramo 7 (decisão 8): `v = detectarTesteYoutube(depois, opts)`; `provavel_teste` → `teste_visivel`; `insuficiente` ou `nada_visivel/um_valor_so` → `estavel_curto`; outro → `depois_ambiguo`.

- [ ] **Step 1: Testes que falham** — `antes` = veredito C1; `agora` = 1 h depois da última leitura de `depois`, salvo onde dito; `depois` começa 1 h após `ultimaVista`. **Gerador do sufixo longo:** `rodadas({ inicio: ultimaVista + 1 h, intervaloMs: 3*3_600_000 + 45*60_000, padroes: Array(8).fill('BBB'), … })` (7 intervalos de 3h45 = janela de 26h15, 24 votos; 4 rodadas de 3 por dia = 6 h de intervalo servem para os casos de 2 dias). O próprio teste afirma a premissa: `expect(msUltima - msPrimeira).toBeGreaterThanOrEqual(24*3_600_000)`. O mesmo gerador serve a "valor C", "oficial A", "oficial nulo" e "2 sem voto no meio":
  - C14 base: 24 leituras B em 26 h, `oficial B` → `{ estado: 'vencedor_provavel', vencedor: TITULO_B, leiturasDescartadas: 0, versaoRegra: 1 }`
  - `AAA` + 24 B → `vencedor_provavel` B, `leiturasDescartadas 3`
  - 10 leituras B → `em_andamento`, `estavel_curto`
  - oficial A → `sem_dado`, `oficial_diverge`; oficial `TITULO_B + ' - YouTube'` → `oficial_diverge`
  - valor C (fora de `antes.variantes`) estável → `valor_fora_do_teste`
  - `depois` com padrões mistos nativos (≥ 3 rodadas mistas em > 30 min) → `em_andamento`, `teste_visivel`
  - `depois` `troca_sem_mistura` (AAA, AAA, BBB, BBB, … sem 18 B finais) → `depois_ambiguo`
  - `depois` vazio → `depois_sem_leitura`; Review Focus 5: só leituras com `erro` → `depois_sem_leitura`
  - 1ª leitura com `lidaEm ≤ ultimaVista` → `janelas_sobrepostas`
  - 10 leituras e `agora` = última + 72 h → `coleta_encerrada`
  - `tituloOficial null` em todo o sufixo → `oficial_nao_lido`
  - B×24 com 2 leituras sem voto (renderers discordantes) no meio → `vencedor_provavel`
  - B×27 com 1 voto A na 4ª leitura (sufixo de 23 B em ≥ 24 h) → `vencedor_provavel`, `leiturasDescartadas 4`; B×24 com o voto A na 13ª leitura → sufixo de 11 B → `depois_ambiguo` (`mistura_isolada`). Resultado único em cada versão, nunca disjunção
  - quarentena: `depois` = `ABB` (10 min após uma `escritasConhecidas` de título) + `BBB` 6 h depois = 6 votos < 9 → `insuficiente` → `estavel_curto`; sem a escrita, o mesmo `depois` continua `estavel_curto` (prova que não virou `teste_visivel` por outro caminho); uma 3ª versão com ≥ 2 rodadas mistas fora da quarentena e > 30 min → `teste_visivel`
  - `antes` com `estado 'nada_visivel'` → `antes_sem_teste`
  - C31: `// @ts-expect-error` em `inferirDesfecho(antes, depois, {})`, e a chamada `toThrow(Error)`; também com `depois` vazio: `inferirDesfecho(antes, [], {})` lança (M4)
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; typecheck limpo.
- [ ] **Step 5: suíte do domínio inteira** `cd apps/web && npx vitest run test/youtube/teste-youtube test/youtube/thumb-fingerprint.test.ts > /tmp/vt-teste-youtube.log 2>&1; tail -15 /tmp/vt-teste-youtube.log` → tudo verde (o teste do thumb-fingerprint confirma que nada nosso o alterou).
- [ ] **Step 6:** `git add -- apps/web/src/lib/youtube/teste-youtube/desfecho.ts apps/web/src/lib/youtube/teste-youtube/index.ts apps/web/test/youtube/teste-youtube/desfecho.test.ts && git commit -m "feat: teste-youtube S3, inferirDesfecho" -- apps/web/src/lib/youtube/teste-youtube/desfecho.ts apps/web/src/lib/youtube/teste-youtube/index.ts apps/web/test/youtube/teste-youtube/desfecho.test.ts`

---

## Cobertura do spec

| Spec | Tarefa |
|---|---|
| §2 S0 | T3 |
| §3 S1 | T1 (+ `dhashMaxSame` padrão em T5) |
| §4.1 | T2 |
| §4.2 | T5 |
| §4.3 p.1–5 | T4a (p.1–3) e T4b (p.4–5); p.6–7 T5; p.8 T6 |
| §4.4 | T7 |
| §5 (falha em verde) | C12, C13, C19, lista vazia (T6); 404 e padrão (T5); `coleta_encerrada` (T7) |
| §4 extração do `hamming` | **substituída pela emenda**: só reexportação em T5 (S2 já no staging) |
| C1–C32b | C1 T4b+T6; C2–C5 T4b; C6–C9 T5+T6; C10–C11 T4b; C12–C13 T6; C14 T7; C15–C17 T2+T4b; C18–C21 T1+T4a+T4b+T6; C22–C23 T5; C24–C30 T4a+T4b; C31 T7; C32a T4b; C32b T5 |
| S4–S9, migration, tela | fora |
