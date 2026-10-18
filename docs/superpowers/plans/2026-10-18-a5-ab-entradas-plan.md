# Entradas do A/B a partir do Observatório — Plano de implementação (2º rascunho, rodada 2 de 18/10)

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans. Passos com caixa (`- [ ]`).

**Objetivo:** o Observatório ganha quatro entradas que **só navegam** até o A/B Lab (cabeçalho do vídeo próprio, menu ⋯, Antes e depois do próprio, troca de concorrente), e `ab-lab/new` valida os parâmetros e desenha a faixa de referência aprovada.

**Arquitetura:** um módulo puro (`_chrome/ab-entradas/`) decide, para cada entrada, entre `testar`, `ver` (teste aberto), `sem-dado` (frase) e nada; os links saem de UM construtor em `lib/youtube/ab-referencia.ts`. O estado "vídeo já em teste" vem de UMA consulta por página (`lerTestesAbertos`, com a guarda de edição DENTRO do leitor), servida aos componentes cliente por um contexto (`AbEntradasProvider`) que também carrega `podeEditar`: fora do provedor, ou com `podeEditar` falso, nada aparece. `ab-lab/new` passa a ler os parâmetros por um esquema Zod.

**Tech stack:** Next.js 16 (server components + `'use client'`), React 19, Zod, Supabase service client, Vitest (jsdom para componente, node para o resto).

**Fontes (o contrato):** `docs/superpowers/mockups/2026-10-17-ab-entradas/INVENTARIO.md`, `RODADA-1.md`, `RODADA-2.md`. **Decisões do dono valem SOBRE o inventário:** (17/10 noite) (1) um nome só, **"Testar no A/B Lab"**, nas três entradas do vídeo próprio; (2) o botão continua na troca de concorrente "não medido". (18/10 tarde) P1 a P4, resumidas abaixo em "Decisões já dadas".

**Código:** `/Users/figueiredo/Workspace/wt-abentr` (origin/staging 8fd151c6b). Abreviações de caminho usadas abaixo:
- `YT/` = `apps/web/src/app/cms/(authed)/youtube/`
- `OBS/` = `YT/competitors/`
- `T/` = `apps/web/test/`
- `SAIDA/` = `/Users/figueiredo/Workspace/bythiagofigueiredo/.superpowers/sdd/a5/abentr/saida/` (saídas de teste e typecheck deste lote; fora de `/tmp`, que os terminais compartilham)

## Decisões já dadas (dono, 18/10 tarde) e perguntas ainda abertas

**Dadas:**
- **P1 (imagem de referência):** origens permitidas `i.ytimg.com` + Vercel Blob, **com o Blob amarrado ao `refVideoId`** (Phil M-3: o caminho tem de começar por `/observatorio/thumbs/<refVideoId>/`). **Sem imagem guardada** (nenhuma imagem na URL, URL recusada, ou 404 do Blob em `onError`): no lugar do quadro hachurado entra uma **imagem substituta**: a thumbnail ORIGINAL do vídeo do concorrente (`i.ytimg.com/vi/<ytId>/hqdefault.jpg`, montada no servidor a partir do `video_id` lido, quando houver) com um **selo numérico discreto**; sem nenhuma, um **quadro neutro genérico**. **Este estado é "mockup a ajustar (Logan/Naksu) antes da tarefa de código dele"** (T3, linha marcada). Hoje não há mockup do selo nem do quadro neutro.
- **P2:** rascunho e fila contam como teste aberto (ver T4 e a pergunta Q-c abaixo para o destino do rascunho).
- **P3:** zero impressões medidas → o botão aparece.
- **P4:** "Próximo" e "Passo N de 5" ficam (assistente é da sessão do A/B).

**Abertas, com o PADRÃO recomendado já escrito no plano (marcadas `[PERGUNTA AO DONO]` no ponto exato):**
- **Q-a** (Phil I-5): vídeo próprio "não medido" mostra o botão. Padrão: SIM (T5). Restrito e falhou continuam escondendo.
- **Q-b** (Phil I-1, Yannis I3): "Teste em andamento desde dd/mm" no lugar de "dia D de N". Padrão: "desde dd/mm", fuso America/Sao_Paulo (T4).
- **Q-c** (Yannis B3): rascunho → link para a lista do A/B Lab com o texto "Rascunho no A/B Lab" em vez de "Ver teste". Padrão: sim (T1, T4).

Se o dono responder diferente: Q-a "não" volta `nao_medido` como estado de `sem-dado` com a frase "Este vídeo ainda não foi medido. O teste precisa de uma base para comparar." (T5); Q-b "dia D de N" exige antes uma função única de dias no A/B (dívida declarada); Q-c "Ver teste" exige "abrir rascunho por id" na sessão do A/B.

## Correções ao inventário (achadas no código)

1. **O cabeçalho do vídeo próprio não é `_historico/historico-screen.tsx`.** A rota `OBS/video/[id]/page.tsx:60-89` desvia o vídeo próprio para `ProprioVideoScreen` (`OBS/_proprio/video-screen.tsx`, linha de ações `.vp-a`, linhas 131-134). `historico-screen.tsx` (`.arow`) só desenha vídeo de concorrente.
2. **`_proprio/header-model.ts` é o cabeçalho do CANAL próprio**, não do vídeo. A faixa do vídeo (`video-model.ts`, `faixaDe`) só usa dado público. O "sem dado" do vídeo sai de `VideoBlocosView` (`OBS/_proprio/video-blocos-model.ts:115-129`): `acesso`, `ausencia` (ver Q3).
3. **O Antes e depois do próprio é `OBS/_proprio/trocas.tsx` + `trocas-model.ts`**, não `_historico/compare.tsx`. A troca que veio de um teste **já tem** o link "Abrir o teste A/B" (`trocas.tsx:80-82`, `trocas-model.ts:337`): fica como está.
4. **A imagem "depois" de uma troca de concorrente é do Vercel Blob**, não de `i.ytimg.com` (`OBS/_canal/trocas-model.ts:96`, `blobUrl`). Vale a regra do trem 8 (`YT/ab-lab/new/resolver.ts:54-67`): `i.ytimg.com` ou `*.public.blob.vercel-storage.com`, só https, sem query; este plano a **aperta** com o amarre ao vídeo (P1).
5. **"Continuar" com a variante B vazia já fica desligado** no assistente: `YT/ab-lab/_components/ab-create-wizard.tsx:242` e `:657`. O botão se chama "Próximo" e o contador "Passo N de 5" (`:622`). O assistente é da sessão do A/B: este plano só **trava com teste** o comportamento (T3).
6. **O destino recusa mais do que o inventário supõe** (Phil I-4, Yannis I1): `getEligibleVideosForPicker` lê só os 100 mais recentes (`YT/ab-lab/queries.ts:304-310`), e `createAbTest` recusa Short (`isCertainShort`) e vídeo sem `thumbnail_hq_url` (`actions.ts:125-131`) só no último passo. Por isso a entrada some em Short (T5) e `ab-lab/new` aceita vídeo do site fora dos 100 (T2).
7. **O `changeType` do próprio não chegava ao assistente** (Yannis B1): hoje `prefill.testType` só sai com `competitorContext` (`page.tsx:55-62`, `client.tsx:81-87`). T2 e T3 o consertam.

## Respostas às cinco perguntas do brief

**Q1. Qual id vai em `?videoId=`.** `youtube_videos.id` (uuid), o id que o Observatório já tem no próprio (`lib/youtube/observatorio/load.ts:358`, `id: v.id`) e o `[id]` da rota. `ab-lab/new` aceita os dois (`page.tsx:34-53` + `resolver.ts:47-51`). A armadilha: **`ab_tests.youtube_video_id` é a FK uuid para `youtube_videos.id`, apesar do nome** (bug do link do Studio, commit be66e1923; teste em `T/youtube/ab-p4a-t14-queries.test.ts`). Nas entradas: o mapa de testes abertos é chaveado pela FK uuid e consultado com `v.id`, nunca com `v.ytId`; um teste trava isso (T4).

**Q2. "Vídeo já em teste" sem N+1.** Uma consulta por página, só em página de canal próprio ou vídeo próprio, **depois da guarda de edição que mora dentro do leitor**:
`ab_tests.select('id, youtube_video_id, test_type, status, started_at, paused_at, created_at, config').eq('site_id', siteId).in('status', ['draft','active','paused','queued']).order('id').range(0, TETO_ABERTOS)` (no vídeo, `+ .eq('youtube_video_id', uuid)`, com o uuid validado antes). O índice único parcial `ab_tests_one_active_per_video` (`supabase/migrations/20260517000001_ab_testing.sql:32-34`, `status in (draft, active, paused)`) garante no máximo um aberto por vídeo; `queued` fica fora e a escolha entre dois é por prioridade (T4). Volume: dezenas de linhas, varredura sequencial < 1 ms; sem índice composto, **sem migration** (Phil, conta refeita; gatilho para rever: 50 mil linhas). O custo é O(N + T) por página contra N idas. Passar de `TETO_ABERTOS = 500` lança `ObservatoryLoadError(..., true)` como `ler-testes-ab.ts:66` (nunca corta calado). **Leitura que falha:** as entradas mostram "Testar no A/B Lab" (não "Ver teste") e o Sentry recebe um aviso (só `siteId` e código do erro, sem título nem URL); escolha deliberada e **declarada** (Yannis M7): o destino reconfere `draft/active/paused` (`resolver.ts:28-31`, `createAbTest` em `actions.ts:136-147`). **O buraco é `queued`**, que nem o destino nem a ação barram (Phil M-1): vai à seção "Avisos à sessão do A/B".

**Q3. "Sem dado" do vídeo próprio.** Estado `EstadoAusencia` (`OBS/_chrome/ausencia/estado.ts:8`), com **a decisão Q-a** `[PERGUNTA AO DONO]` (padrão recomendado SIM: `nao_medido` mostra o botão, porque o A/B Lab mede o próprio teste e esconder o botão tira o teste de vídeo recém-publicado justamente de quando ele mais vale; `nao_medido` por coleta parada também mostra):
- **Cabeçalho e Antes e depois** (`semDadoDoVideo(blocos)`): `blocos.acesso !== 'ok'` → `blocos.ausencia ?? 'falhou'` (`restrito` só com `sem_direito`, decisão 75); `acesso === 'ok'` → `null` (botão aparece, inclusive `nao_medido`).
- **Menu ⋯** (`semDadoDoCartao(v)`): `v.impEstado` (`OBS/_proprio/videos-model.ts:44`) `restrito`/`falhou` → esse estado; `nao_medido` e zero medido (P3) → `null` (mostra o item).
- Frases (cópia exata): `restrito` → "A leitura deste vídeo é restrita: só quem tem acesso ao Analytics vê os números."; `falhou` → "A leitura deste vídeo falhou. Recarregue a página para tentar de novo." No menu não há frase: o item não existe. (A frase de `nao_medido` do inventário só volta se Q-a for "não".)

**Q4. Validação em `ab-lab/new`.** Esquema Zod em `YT/ab-lab/new/params.ts` (T2). Regra geral: **parâmetro inválido vira ausente, nunca erro de página**; o que some nunca inventa nada (sem faixa, sem pré-escolha). `videoId` ausente = lista normal; `videoId` que não acha vídeo = aviso já existente (`resolver.ts:34-37`).

**Q5. Reporter.** `podeEditar` falso → o provedor entrega `null` e nenhum dos quatro desenha nada (nem frase de "sem dado"); `lerTestesAbertos` devolve `{ acesso: 'negado' }` sem tocar o banco. Testes por estado em cada tarefa.

## Restrições globais

- NÃO editar `YT/ab-lab/actions.ts` nem as assinaturas de `startAbTest`/`createAbTest`; `YT/ab-lab/_components/*` e `YT/ab-lab/queries.ts` também não (são da sessão do A/B). `YT/ab-lab/new/*` é nosso.
- Sem migration.
- Entradas só navegam: `<a href>` sem `target=_blank`; não criam teste, não abrem modal, não preenchem variante B. Nenhum texto com "copiar", "faça igual", "funcionou".
- Sem botão desligado em lugar nenhum: sem dado = sem botão (+ frase onde o inventário pede).
- **Nada de `href` com URL de imagem dentro dos modelos que o pacote "Perguntar a uma IA" também monta** (`ComparisonView`, `TrocaView` do canal, `Hero`): o `href` é calculado no componente (Yannis I6). Rodar a cada tarefa de T6 a T10: `contexto-ia-varredura-de-saida.test.ts` e `contexto-ia-varredura-de-codigo.test.ts`.
- Tokens: no Observatório, as variáveis já usadas nas telas (`var(--text)`, `var(--muted)`, `var(--accent)`…), sem `color-mix()` e sem `var(--x, fallback)`; em `ab-lab/new`, classes `cms-*`.
- Texto numérico novo ≥ 12 px. Alvo de toque 44 px em `(pointer:coarse),(max-width:600px)`.
- `strict`, sem `any`, sem `as unknown as`.
- Datas e dias das frases: **fuso America/Sao_Paulo** (formatador do Observatório, `obs.date.dm`, como `trocas-model.ts:103`); `dayPt` (Pacífico) fica restrito à coleta.
- Testes: `cd /Users/figueiredo/Workspace/wt-abentr/apps/web && npx vitest run <arquivo> > SAIDA/T<n>.txt 2>&1; tail -20 SAIDA/T<n>.txt`. Typecheck ao fim de cada tarefa: `npx tsc --noEmit -p /Users/figueiredo/Workspace/wt-abentr/apps/web > SAIDA/tsc.txt 2>&1; grep -c "error TS" SAIDA/tsc.txt` → `0`.
- Commit por caminho explícito: `git add <caminhos> && git commit -m "..." -- <caminhos>`; nunca `git add -A`.

## Foco de revisão (o que nenhum teste de tarefa cobre sozinho)

1. URL do Observatório com título de concorrente contendo `&`, `#`, `?`, emoji ou aspas: o link tem de chegar inteiro (`URLSearchParams`). Teste na T1.
2. Teste aberto de **outro** vídeo com o mesmo ytId noutro site: a consulta é por `site_id`; o mapa é por uuid. Teste na T4.
3. Teste `active` sem `started_at` ou com `started_at` inválido: a frase cai para "em andamento", nunca "desde NaN/NaN". Teste na T4.
4. Faixa recolhida e depois navegação para outro vídeo no mesmo assistente: recolher não apaga a referência. Teste na T3.
5. `refVideoId` de um vídeo de concorrente de OUTRO site (cliente de serviço ignora RLS): o nome do canal e o `video_id` não podem vazar. Teste na T2.
6. `started_at = '2026-10-18T04:00:00Z'` (01:00 em São Paulo) dá "desde 18/10", não 17/10 (Phil I-2). Teste na T4.
7. Troca de concorrente desfeita (A→B→A): a referência é a imagem/título de B, nunca a de volta à original (Phil I-3). Teste na T9a.
8. Vídeo uuid do site FORA dos 100 mais recentes e Short: o primeiro abre o assistente com o vídeo; o segundo não tem botão (Phil I-4, Yannis I1). Testes T2 e T5.

---

### Tarefa 1: Construtor de links e regra de imagem de referência

**Arquivos:**
- Criar: `apps/web/src/lib/youtube/ab-referencia.ts` — **módulo puro: sem `server-only`, sem Sentry, sem env** (é importado por componentes cliente: `video-menu.tsx`, `compare.tsx`, `client.tsx`; Yannis M4)
- Modificar: `YT/ab-lab/new/resolver.ts` (remover `thumbReferenciaSegura`, reexportar de `ab-referencia`; corrigir o comentário "o Blob do projeto" para dizer que o curinga aceita qualquer loja Blob e que a dívida está declarada, Yannis M1)
- Teste: `T/youtube/ab-referencia.test.ts` (`// @vitest-environment node`)

**Interfaces (produz):**
```ts
export type TipoTroca = 'thumbnail' | 'title'
export const AB_BASE = '/cms/youtube/ab-lab'
export const TITULO_REF_MAX = 300 // tamanho da URL, não regra do YouTube; conta por Array.from(t).length
export function thumbReferenciaSegura(url: string | undefined | null): string | null   // move sem mudar o comportamento
export function thumbDoVideoDeReferencia(url: string | null, refVideoId: string | null, ytId: string | null): string | null
  // Blob só se o caminho começa por /observatorio/thumbs/<refVideoId>/ ; ytimg só se /vi/<ytId>/ ; senão null
export function thumbOriginalYtimg(ytId: string | null): string | null  // https://i.ytimg.com/vi/<ytId>/hqdefault.jpg se ytId casa /^[\w-]{11}$/
export function tituloReferencia(t: string | undefined | null): string | null           // trim; vazio ou > TITULO_REF_MAX → null
export function hrefNovoTesteProprio(videoUuid: string, tipo?: TipoTroca): string     // `${AB_BASE}/new?videoId=…[&changeType=…]`
export function hrefNovoTesteConcorrente(p: { tipo: TipoTroca; thumb: string | null; titulo: string | null; refVideoId: string; refTroca?: string | null }): string
export function hrefTesteAb(testId: string): string        // `${AB_BASE}/${encodeURIComponent(id)}`
export function hrefListaAb(): string                      // AB_BASE (lista do A/B Lab; destino do rascunho, Q-c)
export function tipoDaLane(l: 'title' | 'thumb' | 'desc'): TipoTroca | null // desc → null
```
(`hrefRascunhoAb` e `?draft=` saem do plano: nenhum ponto do código monta `ab-lab/new?draft=` e o destino não reabre o rascunho; Yannis B3.)

- [ ] **Passo 1: testes que falham**
  - `hrefNovoTesteProprio('0b4c…', 'thumbnail')` === `'/cms/youtube/ab-lab/new?videoId=0b4c…&changeType=thumbnail'`; sem tipo, sem `changeType`.
  - `hrefNovoTesteConcorrente({ tipo:'title', thumb:null, titulo:'Japão & Coreia #1 ?x="y" 🇯🇵', refVideoId:'u', refTroca:'c1' })`: `new URL(href, 'http://x').searchParams` devolve `ref=competitor`, `changeType=title`, `competitorTitle` idêntico ao original, `refVideoId=u`, `refTroca=c1`, e **sem** `competitorThumb`.
  - `thumb` fora da regra (`http://i.ytimg.com/a.jpg`, `https://evil.com/a.jpg`, `https://i.ytimg.com.evil.com/a.jpg`) → sem `competitorThumb`; `https://x.public.blob.vercel-storage.com/a.jpg?t=1` → `https://x.public.blob.vercel-storage.com/a.jpg`.
  - `thumbDoVideoDeReferencia`: Blob `…/observatorio/thumbs/<refVideoId>/abc.jpg` com o `refVideoId` certo → aceita; mesmo arquivo com OUTRO `refVideoId` → `null`; ytimg `/vi/<ytId>/hqdefault.jpg` com o `ytId` certo → aceita, com outro → `null`; `refVideoId` ausente → `null` (conservador: sem vínculo não há referência de imagem).
  - `thumbOriginalYtimg('dQw4w9WgXcQ')` → URL; `'x'`, `null`, `'a/b'` → `null`.
  - `titulo` com 301 caracteres → sem `competitorTitle`; **título de 95 caracteres com 6 bandeiras (passa de 100 em `.length`) é aceito** (Yannis M2).
  - `tipoDaLane('thumb') === 'thumbnail'`, `('desc') === null`; `hrefListaAb() === '/cms/youtube/ab-lab'`.
  - `T/ab-new-resolver.test.ts` continua verde sem mudança (o reexport mantém a importação).
- [ ] **Passo 2: rodar e ver falhar** (`npx vitest run test/youtube/ab-referencia.test.ts`) → FAIL "Cannot find module".
- [ ] **Passo 3: implementar** com `URLSearchParams` (ordem fixa: `ref, changeType, competitorThumb, competitorTitle, refVideoId, refTroca`).
- [ ] **Passo 4: rodar os dois arquivos** → PASS.
- [ ] **Passo 5: commit** `feat: A5 ab-entradas T1: construtor de links do A/B e regra da imagem de referência` com os três caminhos.

### Tarefa 2: Parâmetros de `ab-lab/new` por Zod, canal da referência e vídeo fora dos 100

**Arquivos:**
- Criar: `YT/ab-lab/new/params.ts`
- Modificar: `YT/ab-lab/new/page.tsx` (usar o esquema; ler o canal da referência; aceitar vídeo do site fora dos 100), `YT/ab-lab/new/client.tsx` (tipo `CompetitorContext` e prop `tipoInicial`)
- Teste: `T/ab-new-params.test.ts` (node), `T/ab-new-client.test.tsx` (jsdom; uma linha)

**Interfaces:**
- Consome: `thumbReferenciaSegura`, `thumbDoVideoDeReferencia`, `thumbOriginalYtimg`, `tituloReferencia`, `TipoTroca` (T1).
- Produz:
```ts
export interface ParamsNovoTeste {
  draft: string | null            // uuid ou null
  videoId: string | null          // trim, ≤ 64; o formato fino é do resolver (filtroBuscaVideo)
  tipo: TipoTroca | null          // de changeType, COM ou SEM ref (Yannis B1); só 'thumbnail' | 'title'
  referencia: ReferenciaPedida | null
}
export interface ReferenciaPedida {
  tipo: TipoTroca                 // o mesmo valor de ParamsNovoTeste.tipo
  thumb: string | null            // passou por thumbReferenciaSegura; o amarre ao vídeo é feito na página (precisa do ytId)
  titulo: string | null           // já passada por tituloReferencia
  refVideoId: string | null       // uuid
  refTroca: string | null         // /^[A-Za-z0-9:_\/-]{1,80}$/
}
export function lerParamsNovoTeste(raw: Record<string, string | string[] | undefined>): ParamsNovoTeste
export function canalDaReferencia(linha: unknown, siteId: string): { canal: string; ytId: string | null } | null
// em client.tsx:
export interface CompetitorContext extends ReferenciaPedida {
  canal: string | null; hrefOrigem: string | null
  thumbSubstituta: string | null  // thumbOriginalYtimg(ytId) quando a thumb da URL não vale; só o servidor monta
}
// NewTestClient ganha a prop: tipoInicial?: TipoTroca | null
```

Tabela de comportamento (cada linha é um `it`):

| Entrada | Saída |
|---|---|
| nada | `{ draft:null, videoId:null, tipo:null, referencia:null }` |
| `videoId=['a','b']` (repetido) | usa o primeiro, `'a'` |
| `videoId='   '` ou > 64 caracteres | `null` |
| `draft='x'` (não uuid) | `null` |
| `videoId=u&changeType=title`, **sem `ref`** | `{ tipo:'title', referencia:null }` (B1: o tipo chega ao assistente sem faixa) |
| `ref=competitor` sem `changeType` ou com `changeType=combo` | `tipo:null`, `referencia: null` (sem faixa; a pré-escolha do vídeo continua) |
| `ref=outro&changeType=title` | `tipo:'title'`, `referencia: null` |
| `ref=competitor&changeType=thumbnail&competitorThumb=https://evil.com/a.jpg` | `referencia.thumb: null` (cai no estado "sem imagem guardada") |
| `competitorTitle` de 301 caracteres | `titulo: null` |
| `refVideoId='nao-uuid'` | `refVideoId: null` (e `refTroca` também vira null: sem vídeo não há troca) |
| `refTroca='a b<'` | `refTroca: null` |

- [ ] **Passo 1: testes da tabela** → FAIL.
- [ ] **Passo 2: implementar `lerParamsNovoTeste`** com `z.object({...}).safeParse` campo a campo (cada campo com `.catch(null)`, preprocess de array para o primeiro).
- [ ] **Passo 3: `client.tsx` (B1):** `prefill = draftPrefill ? … : tipoInicial ? { testType: tipoInicial } : undefined`, **sem depender de `competitorContext`**. Teste em `T/ab-new-client.test.tsx`: `tipoInicial="thumbnail"` sem `competitorContext` faz o mock do assistente receber `prefill={{ testType: 'thumbnail' }}`; o cliente nunca passa `thumb`/`titulo` ao `prefill`.
- [ ] **Passo 4: `page.tsx`:** trocar a leitura manual (`page.tsx:55-62`) por `lerParamsNovoTeste`, passando `params.tipo` como `tipoInicial`.
  - **Canal da referência (depois da guarda, não em paralelo com ela; Yannis M3):** encadear a leitura em `getAbSiteSettings().then(...)` ou chamar `requireSiteScope` no topo. Com `referencia.refVideoId`, uma consulta **escopada ao site**: `getSupabaseServiceClient().from('competitor_videos').select('id, video_id, competitor_channels!inner(channel_name, site_id)').eq('id', ref).eq('competitor_channels.site_id', siteId).maybeSingle()`. Erro → Sentry (só `siteId` e código), `canal: null`. Achou → `canal = channel_name`, `hrefOrigem = link.historico(ref, refTroca ? { troca: refTroca } : undefined)`, e `thumb = thumbDoVideoDeReferencia(thumb, refVideoId, video_id)` (Blob amarrado ao `refVideoId`; ytimg ao `video_id`), `thumbSubstituta = thumbOriginalYtimg(video_id)`. Não achou (inclusive outro site) → `canal: null, hrefOrigem: null, thumb: null, thumbSubstituta: null`.
  - **Vídeo do site fora dos 100 mais recentes (Phil I-4b):** quando `videoId` é um uuid de vídeo do site que não está na lista elegível, ler esse vídeo por chave primária (escopado ao `site_id`, com os campos do picker, e recusando Short por `isCertainShort` e vídeo sem `thumbnail_hq_url`, com o aviso já existente), conferir teste aberto em `ab_tests` (uma linha, por site e vídeo, **incluindo `queued`**) e acrescentá-lo à lista elegível em vez do aviso "não está entre os mais recentes". Custo: uma leitura por chave e uma por vídeo, só nesse caso.
- [ ] **Passo 5: teste do escopo** (Foco 5): `canalDaReferencia(linha: unknown, siteId)` em `params.ts`, com linha de outro `site_id` → `null` (defesa dupla além do filtro); linha com `video_id` fora de `/^[\w-]{11}$/` → `ytId: null`. Teste de `page.tsx` (ou da função extraída) para o vídeo fora dos 100: uuid do site fora da lista pré-escolhe o vídeo; uuid de outro site, Short e sem thumb HQ mantêm o aviso.
- [ ] **Passo 6: rodar** `T/ab-new-params.test.ts`, `T/ab-new-resolver.test.ts`, `T/ab-new-client.test.tsx` → PASS.
- [ ] **Passo 7: commit** `feat: A5 ab-entradas T2: parâmetros do novo teste A/B validados, tipo pré-marcado e canal da referência` (params.ts, page.tsx, client.tsx, testes).

### Tarefa 3: Faixa de referência no assistente (inventário §5)

**Arquivos:**
- Modificar: `YT/ab-lab/new/client.tsx` (`ReferenciaConcorrente`, linhas 199-228)
- Teste: `T/ab-new-client.test.tsx` (jsdom; ampliar) e `T/ab-wizard-variante-vazia.test.tsx` (jsdom, novo)

**Interfaces:** consome `CompetitorContext` (T2).

Estados e texto exato (um `it` por linha):

| Estado | Esperado |
|---|---|
| `tipo: thumbnail`, `thumb`, `refTroca`, `canal: 'Fulano'` | `<img width=96 height=54 alt="" referrerpolicy=no-referrer>`; "Referência · Fulano trocou a thumbnail"; título em `line-clamp-2`; "Referência, não modelo."; link "Ver a troca" com `href=hrefOrigem`; botão "Recolher" com `aria-expanded="true"` |
| `tipo: title` | sem `<img>`; "Referência · Fulano trocou o título"; título citado em `font-serif`; "Referência, não modelo." |
| **`thumb: null` (ou URL recusada) e `tipo: thumbnail`** — **MOCKUP A AJUSTAR (Logan/Naksu) antes da tarefa de código deste estado** (decisão P1 do dono, 18/10) | no lugar do quadro hachurado "sem imagem guardada": se `thumbSubstituta` existe, `<img>` 96x54 com a thumbnail ORIGINAL do vídeo do concorrente e um **selo numérico discreto** sobre ela (o número e a posição do selo são do mockup; hoje não existem); sem `thumbSubstituta`, um **quadro neutro genérico** 96x54. Texto acessível curto que diga que a imagem é substituta (a redação sai do mockup). Os dois sem `<img>` quebrado |
| `<img>` da thumb dispara `error` (Blob apagado, 404; Phil M-2) | cai no MESMO estado acima (substituta, depois neutro), por estado local, sem nova leitura; teste jsdom que dispara `error` e afirma o quadro; se a substituta também falhar, quadro neutro |
| sem `refTroca` (veio do menu) | "Referência · thumbnail de Fulano" / "Referência · título de Fulano"; link "Ver o vídeo" |
| `canal: null` | "um concorrente" no lugar do nome; sem link |
| recolhida | uma linha "Referência · Fulano trocou a thumbnail" + botão "Mostrar referência" `aria-expanded="false"`; reabrir mostra o mesmo conteúdo (Foco 4: o estado vive em `NewTestClient`) |
| título hostil `<img src=x onerror=…>` | sai como texto (o teste existente continua) |

- Variante B nasce vazia: o cliente nunca passa `thumb`/`titulo` ao `prefill` do assistente (teste: o mock do assistente recebe `prefill` só com `testType`).
- `T/ab-wizard-variante-vazia.test.tsx`: render real de `AbCreateWizard` com `prefill={{ testType: 'title' }}` (passo 2), sem digitar nada → botão "Próximo" `disabled`; digitar um título na variante B → habilitado. **Caso do rascunho local (Yannis I2):** `localStorage` com rascunho de OUTRO tipo para o mesmo `video.id` (`loadDraft(video.id)`, `ab-create-wizard.tsx:257-288`) mais `prefill={{ testType: 'thumbnail' }}`, e a afirmação de que a variante B está vazia. Hoje deve falhar (as variantes vêm de `restoredVariants`): o caso entra com **`it.fails`** e um comentário apontando a sessão do A/B (ver "Avisos à sessão do A/B"). Se o primeiro caso (Próximo desligado) falhar, avisar a sessão do A/B; o conserto é no assistente, que não é nosso.
- Estilo: só tokens `cms-*`; o hachurado antigo deixa de existir; o quadro neutro usa cores literais iguais às do mockup (`index.html`), sem `color-mix()`.

- [ ] **Passo 1: testes** → FAIL. **Passo 2: implementar** (estado `recolhida` em `NewTestClient`; estado local de erro de imagem na faixa; **o estado "sem imagem" só é implementado depois do mockup ajustado**: até lá, a linha fica `it.todo`). **Passo 3: rodar** → PASS. **Passo 4: commit** `feat: A5 ab-entradas T3: faixa de referência com os estados do mockup aprovado` (client.tsx + dois testes).

### Tarefa 4: Testes abertos por página (uma consulta, com guarda) e a frase de cada um

**Arquivos:**
- Criar: `OBS/_chrome/ab-entradas/testes-abertos.ts` (puro), `OBS/_chrome/ab-entradas/ler-testes-abertos.ts` (`import 'server-only'`)
- Teste: `T/youtube/observatorio/ab-entradas-testes-abertos.test.ts` (node)

**Interfaces (produz):**
```ts
export type EstadoAberto = 'andamento' | 'pausado' | 'fila' | 'rascunho'
export interface TesteAbertoView { id: string; estado: EstadoAberto; href: string; rotulo: string; frase: string; curto: string }
export type TestesAbertos = { acesso: 'ok'; porVideo: Record<string, TesteAbertoView> } | { acesso: 'erro' } | { acesso: 'negado' }
export const TETO_ABERTOS = 500
export function testeAbertoDe(row: unknown, dm: (iso: string) => string): TesteAbertoView | null // Zod; linha ruim → null; dm = formatador de SP do Observatório
export function porVideo(rows: readonly unknown[], dm: (iso: string) => string): Record<string, TesteAbertoView> // chave = youtube_video_id (uuid)
export async function lerTestesAbertos(siteId: string, so?: { videoUuid: string }): Promise<TestesAbertos>
  // 1º passo: requireSiteScope({ area:'cms', siteId, mode:'edit' }); !ok → { acesso:'negado' } SEM tocar o cliente (Yannis I4)
  // uuid de `so` inválido → { acesso:'ok', porVideo:{} } sem consulta e sem Sentry (Phil M-9)
  // nunca lança: erro → { acesso:'erro' } + Sentry (só siteId e código)
```

Frases (cópia exata; `<tipo>` = "de thumbnail" | "de título" | "A/B" para `combo`/`description`; `dd/mm` = data em America/Sao_Paulo). **[PERGUNTA AO DONO] Q-b:** padrão recomendado "desde dd/mm" no lugar de "dia D de N" (o número divergia do A/B Lab: detalhe usa `cycles.done`, lista usa `floor(dias)` desde 0, cartão usa 14 fixo; "desde dd/mm" é exato e não pode divergir). Se o dono quiser "dia D de N", antes tem de existir uma função única de dias no A/B.

| status | condição | `frase` | `curto` | `rotulo` | `href` |
|---|---|---|---|---|---|
| active | `started_at` válido | "Teste <tipo> em andamento desde dd/mm." | "em andamento" | "Ver teste" | `hrefTesteAb` |
| active | sem `started_at` ou inválido | "Teste <tipo> em andamento." | "em andamento" | "Ver teste" | idem |
| paused | com `paused_at` | "Teste <tipo> pausado desde dd/mm." (sem `paused_at`: "Teste <tipo> pausado.") | "pausado" | "Ver teste" | idem |
| queued | | "Teste <tipo> na fila do A/B Lab." | "na fila" | "Ver teste" | idem |
| draft | com `created_at` | "Rascunho de teste aberto no A/B Lab desde dd/mm." (sem data: "Rascunho de teste aberto no A/B Lab.") | "rascunho" | "Rascunho no A/B Lab" | **`hrefListaAb()`** (a lista; **[PERGUNTA AO DONO] Q-c:** padrão recomendado = link para a lista com o texto "Rascunho no A/B Lab"; "Ver teste" exigiria "abrir rascunho por id" na sessão do A/B, pois `ab-lab/new?draft=` não reabre o rascunho e `ab-lab/<id>` o desenha como teste ativo) |

Prioridade quando o mesmo vídeo tem duas linhas (`queued` não está no índice único): `active > paused > queued > draft`.

- [ ] **Passo 1: testes**: cada linha da tabela; prioridade; `config` como `{}` e como `null`; `started_at` inválido → frase sem data (Foco 3); `started_at = '2026-10-18T04:00:00Z'` → "desde 18/10" (Foco 6); a chave do mapa é o uuid da FK e `porVideo(...)['dQw4w9WgXcQ']` é `undefined` (Q1); linha `completed` ignorada. `lerTestesAbertos` com cliente falso: confere `.eq('site_id', s)` e `.in('status', [...4])` (Foco 2); **`requireSiteScope` mockado com `ok:false` → `{ acesso:'negado' }` e o cliente NÃO é chamado**; `videoUuid` inválido → `ok` vazio sem consulta; 501 linhas → `{ acesso:'erro' }` e `Sentry.captureMessage` chamado uma vez, sem título nem URL no payload; erro do banco → `{ acesso:'erro' }`.
- [ ] **Passo 2: falhar. Passo 3: implementar** (data por `obs.date.dm`; **sem `dayPt`/`diffDias`**). **Passo 4: passar.**
- [ ] **Passo 5: commit** `feat: A5 ab-entradas T4: testes A/B abertos do site em uma leitura com guarda` (dois arquivos + teste).

### Tarefa 5: Modelo das entradas, permissão e provedor

**Arquivos:**
- Criar: `OBS/_chrome/ab-entradas/modelo.ts` (puro; importa `testes-abertos.ts` e `ler-testes-abertos.ts` só com `import type`; Yannis M4), `OBS/_chrome/ab-entradas/contexto.tsx` (`'use client'`), `OBS/_chrome/ab-entradas/permissao.ts` (server)
- Modificar: `OBS/_canais/montar.ts` (`permissoesDoSite` passa a chamar `podeEditarSite`; Yannis, ponto b do plano)
- Teste: `T/youtube/observatorio/ab-entradas-modelo.test.ts` (node), `T/youtube/observatorio/ab-entradas-contexto.test.tsx` (jsdom)

**Interfaces (produz):**
```ts
// modelo.ts
export const ROTULO_TESTAR = 'Testar no A/B Lab'
export const FRASE_SEM_DADO: Record<'restrito' | 'falhou', string> // as duas frases de Q3 (nao_medido só volta se Q-a for "não")
export type EntradaProprio =
  | { tipo: 'testar'; href: string }
  | { tipo: 'ver'; href: string; rotulo: string; frase: string; curto: string }
  | { tipo: 'sem-dado'; frase: string }
export function entradaDoProprio(a: { podeEditar: boolean; videoUuid: string; dur: number | null; abertos: TestesAbertos | null; semDado: EstadoAusencia | null; tipo?: TipoTroca }): EntradaProprio | null
export function semDadoDoVideo(b: Pick<VideoBlocosView, 'acesso' | 'ausencia'>): EstadoAusencia | null
export function semDadoDoCartao(v: ProprioVideoView): EstadoAusencia | null
export function valorAbEntradas(a: { podeEditar: boolean; abertos: TestesAbertos | null }): AbEntradas | null // reporter → null; abertos 'negado' → null (Yannis M5)
// contexto.tsx
export interface AbEntradas { podeEditar: true; abertos: TestesAbertos | null }
export function AbEntradasProvider(p: { valor: AbEntradas | null; children: ReactNode }): JSX.Element
export function useAbEntradas(): AbEntradas | null // fora do provedor ou valor null → null
// permissao.ts
export async function podeEditarSite(siteId: string): Promise<boolean> // requireSiteScope({ area:'cms', siteId, mode:'edit' }).ok; erro → false
```

Regras de `entradaDoProprio` (um `it` por linha), nesta ordem: `podeEditar` falso → `null`; **`isCertainShort(dur)` (de `lib/youtube/short-classifier.ts`, a MESMA função de `createAbTest`, nunca `isShort`) → `null`** (sem botão nem frase; a frase do Short fica para o Logan, Yannis I1; `dur: 45` → `null`, `61` → `testar`, `null` → `testar`); `abertos.acesso === 'negado'` → `null`; teste aberto (`acesso==='ok'` e há linha) → `ver` com `rotulo`/`frase`/`curto`/`href` da linha (vence "sem dado": o teste já existe); `semDado` → `sem-dado` com a frase; `abertos` `erro` ou `null` → `testar`; senão `testar` com `hrefNovoTesteProprio(videoUuid, tipo)`.
`semDadoDoVideo`: `acesso:'ok'` → `null` (inclui o antigo `nao_medido`; **[PERGUNTA AO DONO] Q-a:** padrão SIM, vídeo próprio "não medido" mostra o botão; restrito e falhou continuam escondendo); `acesso:'negado'` com `ausencia:'sem_direito'` → `restrito`; `acesso:'negado'` com `ausencia: null` → `falhou`; erro → `falhou`.
`valorAbEntradas`: reporter, `negado` e editor com `erro`/`ok`.

- [ ] **Passo 1: testes**; contexto: componente de prova que lê `useAbEntradas()` renderiza nada sem provedor e com `valor={null}`; `permissoesDoSite` e `podeEditarSite` dão o mesmo resultado para editor e reporter.
- [ ] **Passo 2-4: falhar, implementar, passar.**
- [ ] **Passo 5: commit** `feat: A5 ab-entradas T5: modelo das entradas do A/B, permissão de edição e provedor`.

### Tarefa 6: Cabeçalho do vídeo próprio (inventário §1)

**Arquivos:**
- Modificar: `OBS/_historico/montar.ts` (variante `proprio` de `MontarVideo`, linhas 66-72 e 127: `podeEditar: acesso.edita` e `abertos: TestesAbertos | null`), `OBS/video/[id]/page.tsx` (ramo próprio, linhas 60-89), `OBS/_proprio/video-screen.tsx` (prop `ab`, linha `.vp-a` 131-134), `OBS/_proprio/video.css`
- Teste: `T/youtube/observatorio/ab-entradas-cabecalho.test.tsx` (jsdom) e um teste de `montarVideo` com leitores falsos

**Interfaces:** consome `lerTestesAbertos` (T4), `entradaDoProprio`, `semDadoDoVideo` (T5). `ProprioVideoScreen` ganha `ab?: EntradaProprio | null`.

- **Leitura (Yannis I5, Phil M-9):** dentro de `montarVideo`, no `Promise.all` de `montar.ts:98-101`, **só quando `opcoes.trocas && acesso.edita`**, em paralelo com `lerDadosDoVideo` e `lerTrocas` e depois da guarda; usa o **uuid que o `montarVideo` resolveu** (`videoUuid = base.header.id`, `ProprioVideoHeader`, `video-model.ts:31`), nunca o `params.id` bruto. O pacote "Perguntar a uma IA" (sem `trocas`) não lê. **Duração (Yannis N2):** a variante `proprio` de `MontarVideo` NÃO tem `video.id` nem `video.dur`; dentro de `montarVideo`, `durSeg = obs.video(id)?.dur ?? null` (`ObsVideo.dur: number | null`, `types.ts:20`; `obs.video(id)` já é lido ali para `pub`, ramo `lidas`). Vídeo sem data/sem cartão público (`c.undated`) cai em `durSeg: null` e mostra "Testar" (declarado). `MontarVideo.proprio` ganha só `abertos: TestesAbertos | null` e `durSeg: number | null`; nenhum campo novo no modelo que a IA também monta (`ProprioVideoHeader` não ganha `dur`).
- Página: `const ab = m.podeEditar ? entradaDoProprio({ podeEditar: true, videoUuid: m.base.header.id, dur: m.durSeg, abertos: m.abertos, semDado: semDadoDoVideo(blocos) }) : null`.
- Tela, depois de "Ampliar thumbnail": `testar` → `<a className="obs-ch-btn" href>` com ícone frasco + "Testar no A/B Lab"; `ver` → `<a className="obs-ch-btn">{rotulo}</a>` ("Ver teste", ou "Rascunho no A/B Lab" para rascunho) + `<p className="vp-ab-nota">{frase}</p>`; `sem-dado` → só `<p className="vp-ab-nota">{frase}</p>`; `null` → nada. 44 px já vem de `video.css:48` para `.obs-ch-btn` em quadro estreito; conferir que a regra cobre `(pointer:coarse)` também e acrescentar se não.

| Estado | Esperado no teste |
|---|---|
| editor, com dado | link "Testar no A/B Lab", `href=/cms/youtube/ab-lab/new?videoId=<uuid>`, sem `target` |
| editor, vídeo "não medido" (Q-a, padrão) | o mesmo link "Testar no A/B Lab" |
| teste ativo | link "Ver teste" → `/cms/youtube/ab-lab/<id>` + "Teste de thumbnail em andamento desde dd/mm." |
| rascunho | link "Rascunho no A/B Lab" → `/cms/youtube/ab-lab` + "Rascunho de teste aberto no A/B Lab desde dd/mm." |
| restrito / falhou | nenhum link de A/B; a frase exata de Q3 |
| Short (`dur` 45; teste de `montarVideo`: `obs.video(id).dur = 45` não gera `ab`) | nada |
| reporter (`ab={null}`) | nem link nem frase |

- [ ] **Passos TDD 1-4** (inclui: `montarVideo` com reporter (`edita:false`) não chama `lerTestesAbertos`; com `opcoes` sem `trocas` também não; rodar as duas varreduras do pacote da IA). **Passo 5: commit** `feat: A5 ab-entradas T6: Testar no A/B Lab no cabeçalho do vídeo próprio` (montar.ts, page.tsx, video-screen.tsx, video.css, testes).

### Tarefa 7: Antes e depois do vídeo próprio (inventário §4)

**Arquivos:**
- Modificar: `OBS/_proprio/trocas.tsx` (`Trocas` e o item `tr-troca`, linhas 75-82), `OBS/_proprio/trocas.css`, `OBS/_proprio/trocas-model.ts` (`TrocaView` ganha `veioDeTeste: boolean`), `OBS/video/[id]/page.tsx` (passar `ab` a `<Trocas>`)
- Modificar: `OBS/_chrome/ab-entradas/modelo.ts` (+ `entradaDaTroca`)
- Teste: `T/youtube/observatorio/ab-entradas-trocas-proprio.test.tsx` (jsdom) e o de modelo (T5)

**Interfaces:**
```ts
export const CHIPS_COM_MEDIDA: ReadonlySet<Chip> = new Set(['subiu', 'caiu', 'sem-diferenca'])
export function entradaDaTroca(t: Pick<TrocaView, 'campo' | 'chip' | 'veioDeTeste'>, ab: EntradaProprio | null, videoUuid: string):
  | { tipo: 'testar'; href: string } | { tipo: 'sem-medida'; frase: string } | null
```
Regras: `ab` nulo, `ab.tipo` `sem-dado` ou `ver` → `null` (com `ver`, o aviso único no topo cuida); **`t.veioDeTeste` → `null`** (o link existente fica). `veioDeTeste` sai do dado da troca (`abTestId != null` ou `origem === 'ab_lab'` na versão), **nunca de `origem.teste`**, cujo link some quando a leitura do A/B falha, está negada, o teste foi apagado ou ficou fora do teto de 50 (Yannis B2); `t.chip` em `CHIPS_COM_MEDIDA` → `testar` com `hrefNovoTesteProprio(videoUuid, t.campo === 'thumb' ? 'thumbnail' : 'title')`; `t.chip` em `depois-nao-medido` ou `ainda-nao-da` → `sem-medida` "Sem medida depois da troca, não há base para comparar."; demais chips → `null`. **Decisão do plano (Phil M-4, a confirmar com o Logan):** `antes-nao-medido`, `sem-antes` e `sem-dias` ficam em `null` (o chip da própria troca já diz o motivo); se o Logan quiser a frase, entram em `sem-medida`.

Tela: botão "Testar no A/B Lab" (decisão 1 do dono, no lugar de "Testar esta troca") + dica **"Abre o teste neste vídeo com o tipo desta troca já marcado."** (a promessa "com esta troca como ponto de partida" é falsa: a URL leva só o tipo; Phil M-5. A frase "A variante B começa vazia" **fica de fora enquanto a dívida do rascunho local do assistente não for paga**, Yannis I2; a cópia final é do Logan); com `ab.tipo === 'ver'`, um aviso no topo do bloco "Este vídeo já tem um teste aberto no A/B Lab. " + `ab.frase` com um só link (`ab.rotulo`); nenhum cartão ganha botão. A frase do resultado das trocas **não muda** (`trocas-model.ts:1-3`); a revisão do Logan confere.

- [ ] **Passos TDD 1-4** (estados: troca manual medida; troca vinda de teste; **troca com `abTestId` e `L.testes = { acesso:'erro' }` → `null`; o mesmo com `acesso:'ok'` e a lista sem esse id → `null`**; troca `depois-nao-medido`; vídeo em teste; reporter; vídeo restrito/falhou; Short). **Passo 5: commit** `feat: A5 ab-entradas T7: Testar no A/B Lab no Antes e depois do vídeo próprio`.

### Tarefa 8: Menu ⋯ (inventário §3) e provedor nas páginas de canal

**Arquivos:**
- Modificar: `OBS/_canal/video-menu.tsx` (`Itens`, linhas 18-51), `OBS/_canal/canal.css` (linha 135), `OBS/canal/[id]/page.tsx` (ramos próprio, linhas 63-81, e concorrente, 90-105)
- Modificar: `OBS/_chrome/ab-entradas/modelo.ts` (+ `itensDoMenu`)
- Teste: `T/youtube/observatorio/ab-entradas-menu.test.tsx` (jsdom; importa o `modelo.ts` de verdade, sem mock)

**Interfaces:**
```ts
export type ItemAb = { rotulo: string; href: string; curto?: string }
export function itensDoMenu(v: ChannelVideoView, ab: AbEntradas | null): ItemAb[]
```
Regras: `ab` nulo → `[]`. Próprio (`ehProprio(v)`): `entradaDoProprio({ podeEditar: true, videoUuid: v.id, dur: v.dur, abertos: ab.abertos, semDado: semDadoDoCartao(v) })` → `testar` = `[{ rotulo: 'Testar no A/B Lab', href }]`; `ver` = `[{ rotulo, href, curto }]` (rótulo "Ver teste", ou "Rascunho no A/B Lab" com `curto` "rascunho"); `sem-dado`/`null` (inclui Short) = `[]`. Concorrente: `v.thumbSrc` válido por `thumbReferenciaSegura` → "Testar uma ideia a partir desta thumbnail" (`tipo: thumbnail`, `thumb: v.thumbSrc`, `titulo: v.title`, `refVideoId: v.id`, sem `refTroca`); sempre "Testar uma ideia a partir deste título" (`tipo: title`, `titulo: v.title`, `refVideoId: v.id`).

Tela: grupo depois de "Abrir no YouTube" e de "Ver trocas", separado por `<hr>`, itens `<a role="menuitem" tabIndex={-1} href>` (sem `target`); `curto` em `<small>`. Lista vazia → nem o `<hr>`. CSS: `@media (pointer:coarse),(max-width:600px){#flut .canal-menu [role="menuitem"]{min-height:44px}}` no lugar da regra da linha 135.

Páginas (Yannis I5, leituras em paralelo e com a guarda dentro do leitor):
- ramo próprio (Yannis N1): `m.pagina` só existe depois do `await montarCanal` (`_canal/montar.ts:105-107`), então a leitura é **em série, depois dele**, e **só se `m.tipo === 'proprio' && m.pagina.canEdit`**: `abertos = await lerTestesAbertos(m.pagina.siteId)`; `valor = valorAbEntradas({ podeEditar: m.pagina.canEdit, abertos })`. **Custo declarado:** uma ida a mais ao banco por visita (uma consulta por `site_id` e status, `n` = testes abertos, dezenas, teto 500), somada à latência de `montarCanal`; em compensação não lê em canal de concorrente, canal não encontrado nem para reporter. Não entra em `montarCanal`, que o pacote da IA também usa. UMA leitura por página. A guarda dentro do leitor repete `requireSiteScope` onde a página já sabe `canEdit`: uma ida a mais, aceita e declarada.
- ramo concorrente: usa `m.pagina.canEdit`, que `carregarCanal` já entrega em todos os ramos (`page-data.ts:116`): `valorAbEntradas({ podeEditar: m.pagina.canEdit, abertos: null })`.
- `<AbEntradasProvider valor>` envolve `ProprioScreen` / `CanalScreen`. A ligação (quem embrulha o quê e com que `valor`) é testada por `valorAbEntradas` (T5, Yannis M5).

- [ ] **Passo 1: testes**: reporter (`canEdit` falso) e canal de concorrente NÃO chamam `lerTestesAbertos` (Yannis N1); concorrente com thumb com `thumbSrc` Blob real do fixture (`…/observatorio/thumbs/<v.id>/x.jpg`) e `refVideoId: v.id`: o `href` chega a `competitorThumb` (Phil R2: confirma que `v.id` do cartão é o `competitor_videos.id` do caminho do Blob; sem isso o amarre cai calado na imagem substituta); próprio com dado; próprio com teste ativo (rótulo "Ver teste", `<small>em andamento</small>`); próprio com rascunho ("Rascunho no A/B Lab", `<small>rascunho</small>`, `href=/cms/youtube/ab-lab`); `impEstado` `restrito`/`falhou` → sem item e sem `<hr>`; **`nao_medido` e zero medido → item aparece (Q-a, P3)**; Short → sem item; reporter → sem item; concorrente com thumb; concorrente sem `thumbSrc` → só o do título; setas ↑↓ percorrem os novos itens (o `onKey` existente acha `[role=menuitem]`).
- [ ] **Passos 2-4** (+ duas varreduras do pacote da IA). **Passo 5: commit** `feat: A5 ab-entradas T8: itens do A/B no menu do vídeo e leitura única dos testes abertos na página do canal`.

### Tarefa 9a: Troca de concorrente no Histórico (inventário §2)

**Arquivos:**
- Modificar: `OBS/_historico/montar.ts` (só o tipo `Pagina`, linha 63; N3), `OBS/_historico/compare.tsx` (`Detail`, linhas 36-50), `OBS/video/[id]/page.tsx` (ramo concorrente: provedor), `OBS/_historico/historico.css`
- Modificar: `OBS/_chrome/ab-entradas/modelo.ts` (+ tipo e construtor)
- Teste: `T/youtube/observatorio/ab-entradas-troca-concorrente.test.tsx` (jsdom) + casos de modelo em `T/youtube/observatorio/ab-entradas-modelo.test.ts`

**Interfaces:**
```ts
export type AbRefTroca = { tipo: 'testar'; href: string } | { tipo: 'sem-imagem'; frase: string }
export const FRASE_SEM_IMAGEM = 'Sem imagem guardada desta troca: não há o que usar de referência.'
export function abRefDaTroca(p: { tipo: TipoTroca | null; own: boolean; thumbDepois: string | null; tituloDepois: string | null; tituloDoVideo: string; refVideoId: string; refTroca: string }): AbRefTroca | null
```
Regras: `own` verdadeiro (vídeo de canal próprio) → `null` (a entrada do próprio é o Antes e depois; Phil M-8, **explícito, nunca inferido de `channelHref === null && pin === null`**); `tipo` nulo (descrição) → `null`; `thumbnail` com `thumbReferenciaSegura(thumbDepois)` nulo → `sem-imagem`; `thumbnail` → `testar` com `titulo: tituloDoVideo`; `title` → `testar` com `titulo: tituloDepois`. **A medida não entra** (decisão 2 do dono: troca `não medido` mantém o botão). O estado `sem-imagem` das trocas continua frase sem botão (o inventário); a imagem substituta de P1 vale na faixa de `ab-lab/new` (T3), não aqui.

- **Fonte (Phil I-3, Yannis I6 — divergência resolvida pelo mais conservador):** o `abRef` NÃO entra em `ComparisonView` e é calculado no componente (`Detail`), não em `buildHistoricoView`. Mas a fonte tem de ser a **troca**, não "o último `BaSide`" (que, em A→B→A, é a original para a qual ele voltou, `view-model.ts:888-894`): no título, o `after` da primeira troca do grupo; na thumb, `blobUrl` da versão `c0.toId` (igual à aba Trocas, `OBS/_canal/trocas-model.ts:96-106`); `refTroca = c0.id` (`changeId`). **Passo 0 da tarefa:** conferir quais campos de `ComparisonView` já carregam o `c0.toId`/`c0.after`; se a vista não os tiver, acrescentar só campos primitivos neutros (`depoisThumbSrc`, `depoisTitulo`, sem `href`) e rodar as duas varreduras do pacote da IA; se uma delas falhar, mover o cálculo para um seletor fora do modelo compartilhado. Jamais um `href` dentro do modelo.
- Em `Detail`, depois de `runLines`: com `useAbEntradas()` não nulo, `testar` → `<a className="btn">Testar uma ideia no meu canal</a>`; `sem-imagem` → `<p className="src">{frase}</p>`; reporter → nada.
- Página do vídeo de concorrente (Yannis I5): `const abrirPagina = cache(() => openObservatoryPage(podeEditarSite))` — o `extra` que já existe (`page-data.ts:63-69`), em paralelo com o dataset e depois da guarda; `m.pagina.extra` passa a ser o booleano (Yannis N3: em `_historico/montar.ts:63`, `type Pagina = ObservatoryPage<boolean | undefined>`, com `undefined` tratado como `false`, porque o pacote da IA passa o seu `abrir` sem `extra`; o typecheck pega o resto); `valor = valorAbEntradas({ podeEditar: extra, abertos: null })`. O provedor envolve `tela` (inclusive a reserva do `Suspense`).

- [ ] **Passo 1: testes**: thumb com imagem Blob; thumb sem imagem → frase; título; descrição → nada; troca `não medido` (efeito `aguardando`/`sem-serie`) mantém o botão; reporter → nada; `href` decodificado traz `refTroca` = `changeId`; **fixture A→B→A: `competitorThumb` é a de B, nunca a restaurada (Foco 7)**; um teste por grupo título + thumb; um `it` com um id de troca REAL do fixture do Histórico contra a regex de `refTroca` (Phil, item não verificado).
- [ ] **Passos 2-4** (+ duas varreduras do pacote da IA). **Passo 5: commit** `feat: A5 ab-entradas T9a: Testar uma ideia no meu canal nas trocas do Histórico`.

### Tarefa 9b: Troca de concorrente na aba Trocas do canal (inventário §2)

**Arquivos:**
- Modificar: `OBS/_canal/trocas.tsx` (`Linha`), `OBS/_canal/canal.css`
- Teste: `T/youtube/observatorio/ab-entradas-troca-canal.test.tsx` (jsdom)

**Interfaces:** consome `abRefDaTroca` e `AbEntradasProvider` (T5, T9a); a página do canal já traz o provedor (T8).
- Em `Linha`, o `abRef` é calculado no componente com os campos que a vista já tem (`agora.thumb`, `agora.texto`, `title`, `videoId`, `t.id`, o mesmo id que o modelo já põe em `troca=`), `own: false`. **`_canal/trocas-model.ts` não ganha campo** (Yannis I6). Mesmo desenho de T9a.

- [ ] **Passos TDD 1-4** (thumb, título, sem imagem, descrição, reporter, canal próprio sem a entrada; duas varreduras). **Passo 5: commit** `feat: A5 ab-entradas T9b: Testar uma ideia no meu canal na aba Trocas`.

### Tarefa 10: Cartões de Mudanças

**Arquivos:**
- Modificar: `OBS/_mudancas/change-hero.tsx` (linha 78-79, ao lado de "Ver histórico do vídeo"), `OBS/mudancas/page.tsx` (provedor)
- Teste: `T/youtube/observatorio/ab-entradas-mudancas.test.tsx` (jsdom)

**Interfaces:** consome `abRefDaTroca` (T9a). **Fonte (Phil R1):** o Hero já traz `thumbs[]` com "Antes"/"Depois" por `fromId`/`toId` (`_mudancas/view-model.ts:289`); `abRefDaTroca` usa o "Depois" (`toId`) como `thumbDepois` e o título `after` do próprio change como `tituloDepois`, nunca a última versão restaurada. **Teste:** `it` A→B→A (fixture com a thumb restaurada à original: `competitorThumb` é a de B, Foco 7). **`_mudancas/view-model.ts` não ganha `abRef`** (Yannis I6): o componente chama `abRefDaTroca` com os campos do `Hero`, e `own` vem **explícito** de `ch.own` (`OBS/_mudancas/view-model.ts:461`), passado ao `Hero` como booleano simples; vídeo de canal próprio → `null`.
- `mudancas/page.tsx` (Yannis I5): `Promise.all([montarMudancas(flat), podeEditarSite(siteId)])`, com o `siteId` de `getSiteContext()`; `valor = valorAbEntradas({ podeEditar, abertos: null })`.

- [ ] **Passos TDD 1-4** (thumb, título, sem imagem, descrição, próprio, reporter; duas varreduras). **Passo 5: commit** `feat: A5 ab-entradas T10: entrada do A/B nos cartões de Mudanças`.

### Tarefa 11: Navegador (Gio)

Depois de T1-T10 em staging local autenticado (`docs/ops/runbook-cms-e2e-local.md`), Gio roda, em **1440 e 390**, **tema escuro e claro**, como **dono (editor)** e como **reporter**:

1. Vídeo próprio com dado → "Testar no A/B Lab" → `ab-lab/new` abre o assistente com o vídeo escolhido **e o tipo já marcado quando vem do Antes e depois**; "Próximo" desligado até haver variante B. Vídeo "não medido": o botão aparece (Q-a). Short: sem botão.
2. Vídeo próprio com teste ativo → "Ver teste" + "desde dd/mm" (a MESMA data que o A/B Lab mostra, inclusive teste iniciado de madrugada) → página do teste. Vídeo com rascunho → "Rascunho no A/B Lab" → a lista, onde o rascunho aparece.
3. Vídeo próprio restrito (conta sem `sem_direito` simulada) e com leitura falhando (desligar a rede da leitura privada no local) → frase certa, sem botão.
4. Menu ⋯ na grade, na tabela e na Lista do canal próprio e do concorrente: itens, `<hr>`, setas, Esc, alvo 44 px em 390.
5. Antes e depois do próprio: troca medida (botão), troca vinda de teste (só "Abrir o teste A/B", também com a leitura do A/B falhando), vídeo em teste (aviso único).
6. Troca de concorrente no Histórico, na aba Trocas e em Mudanças: thumbnail (faixa com miniatura e "Ver a troca"), título (citação em serifa), sem imagem (frase, sem botão); do menu (faixa "thumbnail de <canal>", "Ver o vídeo"); "Recolher"/"Mostrar referência"; imagem do Blob apagada → estado "sem imagem" (substituta ou neutro, depois do mockup ajustado).
7. URL adulterada: `competitorThumb=https://evil.com/x.jpg`, Blob de OUTRO vídeo, `changeType=combo`, `refVideoId` de outro site, título de 301 caracteres → sem imagem de terceiro, sem faixa, sem nome de canal, sem erro de página. Vídeo do site fora dos 100 mais recentes abre o assistente com o vídeo.
8. Reporter: nenhuma das entradas em nenhuma tela; `ab-lab/new` direto continua barrado pela guarda de edição.
9. Sem overflow horizontal em 390; contraste dos textos novos ≥ 4,5:1 nos dois temas; capturas em `docs/superpowers/mockups/2026-10-17-ab-entradas/codigo-shots/`.

Veredito em texto (até 10 linhas) + lista de defeitos com passos exatos.

---

## Conferências de leitura que o deploy pede (Phil, seção 5; sem migration)

| Quando | O quê | Esperado |
|---|---|---|
| Antes da T4 | `select status, count(*) from ab_tests where site_id = '<site>' and status in ('draft','active','paused','queued') group by 1;` | dezenas no máximo |
| Antes da T4 | `select youtube_video_id, array_agg(status) from ab_tests where status in ('draft','active','paused','queued') group by 1 having count(*) > 1;` | 0 linhas (se houver, é `queued` + `draft`, e a prioridade da T4 é exercida) |
| Antes da T2 | `select count(*) from youtube_videos where site_id = '<site>' and is_hidden = false;` | se > 100, o ajuste "fora dos 100" atinge vídeos reais hoje |
| D+0 do deploy | abrir um vídeo próprio com teste `active` e o mesmo teste no A/B Lab | a data "desde dd/mm" igual nas duas telas |

## Avisos à sessão do A/B (sem tarefa de código nossa em `actions.ts`, `_components/*` ou `queries.ts`)

1. **`queued` sem barreira** (Phil M-1): `getEligibleVideosForPicker` marca `hasActiveTest` só com `draft/active/paused` (`queries.ts:322`), `createAbTest` confere só esses três (`actions.ts:136-143`) e o índice único também não inclui `queued`. Um `queued` + um novo `draft` no mesmo vídeo é possível. Nossa mitigação: prioridade `active > paused > queued > draft` na T4 e a conferência de `queued` no acréscimo do vídeo fora dos 100 (T2).
2. **Rascunho local do assistente passa por cima de `prefill` e de "variante B nasce vazia"** (Yannis I2): `loadDraft(video.id)` restaura variantes e passo. Travado por `it.fails` na T3; enquanto isso a dica do Antes e depois não promete variante B vazia.
3. **Gravar a referência em config** (Phil M-6): `createAbTest` gravar `config.referencia = { refVideoId, refTroca, tipo }` (dado público, pequeno, morre com o teste em cascata) para responder, meses depois, "os testes inspirados em troca de concorrente ganharam mais?". O rascunho também perde a faixa hoje.
4. **Abrir rascunho por id** (Yannis B3): `getAbDraftById` não devolve as variantes e `ab-lab/<id>` desenha o rascunho como teste ativo. Necessário se o dono responder "Ver teste" em Q-c.
5. **Três contas do "dia do teste"** (`queries.ts:432`, `active-detail.tsx:110`, `active-test-card.tsx:52`): uma função única em `lib/youtube/`. Pré-requisito para "dia D de N" voltar ao Observatório (Q-b).
6. **Short sem barreira no seletor** e **vídeo sem `thumbnail_hq_url`**: falham só no último passo, em inglês. Nossa mitigação: sem botão em Short (T5) e aviso no vídeo fora dos 100 (T2).
7. **Curinga do Blob** (`resolver.ts:60`, CSP `lib/security/csp.ts:65`): aceita qualquer loja `*.public.blob.vercel-storage.com`. Nossa mitigação: o amarre ao `refVideoId` (T1/T2). Prender ao host da loja do projeto quando a CSP for apertada.
8. **Reporter em `ab-lab/new` cai no `error.tsx`** (o `requireEditAccess` lança), sem redirecionar: fora deste lote.
9. **Nomes no assistente** (P4): "Próximo" e "Passo N de 5" ficam; "Continuar"/"Passo 2 de 3" do mockup só se o dono pedir.

## Emenda 18/10 (rodada 2): achado → onde foi aplicado

Pareceres: `.superpowers/sdd/a5/abentr/plano-phil.md` (P) e `plano-yannis.md` (Y). Onde divergiram, seguiu-se o mais conservador (registrado na última coluna).

| Achado | Resumo | Aplicado em | Divergência / nota |
|---|---|---|---|
| Y B1 | `changeType` do próprio se perdia | T2 (`tipo` no nível de cima, `tipoInicial`, 2 testes); T3; correção 7 | |
| Y B2 | "veio de teste" por `origem.teste` | T7 (`veioDeTeste` no `TrocaView`, 2 testes) | cobre também P M-4 (`falhou`/`sem-acesso`) |
| Y B3 | rascunho aponta para destino que não reabre | T1 (`hrefListaAb`, sai `hrefRascunhoAb`); T4 (tabela); Q-c | pergunta ao dono Q-c, padrão do brief |
| P I-1 / Y I3 | "dia D de N" diverge do A/B Lab | T4 ("desde dd/mm", sem `diffDias`); Q-b; Aviso 5 | concordaram; vai ao dono |
| P I-2 | data no fuso do Pacífico | T4 (formatador de SP, sem `dayPt`); restrições globais; Foco 6 | |
| P I-3 | referência da troca desfeita (A→B→A) | T9a (fonte = troca, `c0.toId`/`c0.after`; Foco 7; fixture) | P queria `abRef` no `ObsChange`; Y no componente: **componente, com fonte da troca** (T9a passo 0) |
| P I-4 / Y I1 | botão em Short e vídeo fora dos 100 | T5 (`isCertainShort`, `dur`); T2 (vídeo fora dos 100); T8; Foco 8; correção 6 | ambas as pontas (a) e (b) aplicadas, conservador |
| P I-5 | vídeo novo/não medido sem botão | T5 (`semDadoDoVideo`, Q3); T8; Q-a | pergunta ao dono Q-a, padrão SIM |
| Y I4 | `lerTestesAbertos` sem guarda | T4 (`requireSiteScope` dentro; `negado`; teste) | |
| Y I5 / P M-9 | paralelismo não fechava; id bruto da rota | T6 (dentro de `montarVideo`, uuid resolvido); T8 (`canEdit`, leitura junto de `montarCanal`); T9a (`extra`); T10 (`Promise.all`); T4 (uuid validado) | |
| Y I6 | `abRef` nos modelos compartilhados com a IA | T9a, T9b, T10 (componente calcula); restrições globais (varreduras) | |
| Y I7 | T9 grande demais | T9a e T9b | |
| Y I2 | rascunho local sobre o `prefill` | T3 (`it.fails`); T7 (dica sem "variante B vazia"); Aviso 2 | sessão do A/B |
| P M-1 | `queued` sem barreira | Q2 (frase corrigida); T2 (confere `queued`); Aviso 1 | sessão do A/B |
| P M-2 | 404 do Blob sem estado | T3 (`onError` → estado "sem imagem"); P1 | decisão P1 do dono: imagem substituta; mockup a ajustar |
| P M-3 | imagem não amarrada ao vídeo | T1 (`thumbDoVideoDeReferencia`); T2 (aplicação com `video_id`) | P1: Blob amarrado ao `refVideoId`; ytimg ao `video_id` |
| P M-4 | `origem.teste` e chips sem base | T7 (`veioDeTeste`; chips: chip basta, a confirmar com Logan) | |
| P M-5 | dica promete o que a URL não leva | T7 (nova dica) | |
| P M-6 | referência some depois do teste | Aviso 3 | sessão do A/B |
| P M-7 | rascunho sem idade | T4 (`created_at`, frase com data) | |
| P M-8 | "próprio" inferido em Mudanças | T9a (`own` explícito), T10 (`ch.own`) | |
| Y M1 | curinga do Blob | T1 (comentário do resolver); Aviso 7 | dívida declarada |
| Y M2 | `TITULO_MAX` em UTF-16 | T1 (`TITULO_REF_MAX = 300`, `Array.from`, teste) | |
| Y M3 | leitura do canal antes da guarda | T2 passo 4 | |
| Y M4 | módulo cliente puro | T1 (nota), T5 (`import type`), T8 (teste sem mock) | |
| Y M5 | ligação nas páginas sem teste | T5 (`valorAbEntradas`), T8 | |
| Y M6 | caminhos relativos e `/tmp` | restrições globais (`SAIDA/`, caminho absoluto no `tsc`) | |
| Y M7 | falha de leitura → `testar` | Q2 (declarado); T4 (teste do Sentry) | |
| P decisão P1 (dono) | imagem substituta | decisões já dadas; T3 (linha marcada "mockup a ajustar"); T2 (`thumbSubstituta`) | |
| P decisões P2 a P4 (dono) | rascunho/fila, zero medido, nomes | T4, T8, avisos | P2 refinada por Q-c |

## Emenda 18/10 (rodada 3): achado → onde foi aplicado

Pareceres: `.superpowers/sdd/a5/abentr/plano-yannis-r2.md` (Y) e `plano-phil-r2.md` (P). Código conferido em `wt-abentr` (`_canal/montar.ts:105-107`, `_historico/montar.ts:63-72`, `types.ts:20`, `page-data.ts:32`, `_mudancas/view-model.ts:289`).

| Achado | Resumo | Aplicado em |
|---|---|---|
| Y N1 | `m.pagina` só existe depois do `await montarCanal`; "em paralelo" não se implementa | T8, "ramo próprio": leitura em série, só se `m.tipo === 'proprio' && m.pagina.canEdit`, custo declarado; teste: reporter e concorrente não chamam o leitor (T8, passo 1) |
| Y N2 | `m.video.id`/`m.video.dur` não existem na variante `proprio` | T6, "Leitura": `videoUuid = base.header.id`, `durSeg = obs.video(id)?.dur ?? null`, `MontarVideo.proprio` ganha `abertos` e `durSeg`; chamada da página e teste de `dur: 45` ajustados |
| Y N3 | `m.pagina.extra` booleano quebra `Pagina = ObservatoryPage<undefined>` | T9a, arquivos (`_historico/montar.ts:63`) e item "Página do vídeo de concorrente": `ObservatoryPage<boolean \| undefined>`, `undefined` = `false` |
| P R1 | T10 sem a fonte "Depois" nem o fixture A→B→A | T10, "Interfaces": `thumbs[]` `toId` e título `after`; `it` A→B→A |
| P R2 | amarre do Blob exige `v.id` = `competitor_videos.id` do caminho | T8, passo 1: `it` com `thumbSrc` Blob real e `refVideoId: v.id` chegando a `competitorThumb` |

## Acordo (18/10)
Phil r2: ACORDO (`plano-phil-r2.md`). Yannis r2: VOLTA com N1–N3; aplicados na rodada 3; conferidos pelo controlador nas linhas 290-296, 343-351, 367-371 como o Yannis pediu ("ACORDO conferindo só essas três linhas"). Pendentes do dono: Q-a, Q-b, Q-c (padrão recomendado em uso); mockup do estado sem imagem (Logan/Naksu).
