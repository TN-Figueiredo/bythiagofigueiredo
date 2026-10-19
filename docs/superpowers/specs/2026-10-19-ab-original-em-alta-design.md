# Spec: original em alta resolução no A/B Lab

Estado: rascunho r1 (Opus), para Phil (dados) e Yannis (software).
Requisito: `.superpowers/sdd/ab-lab/original-em-alta/spec-brief.md`.
Tela: `docs/superpowers/mockups/2026-10-19-ab-original-em-alta/` (index.html + README.md, c0c9b2f4e, aprovado pelo dono em 19/10). Decisões do dono: `.superpowers/sdd/ab-lab/original-em-alta/decisoes-dono.md` e as 7 do README.
Problema: item 1 de `.superpowers/sdd/ab-lab/melhorias-pos-ensaio-t19.md` (checkout principal).

## 0. O problema, no código de hoje

- A original de um teste de imagem é a **cópia pública** do YouTube. `createAbTest` e `batchStartTests` (`apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`) chamam `preserveOriginalThumbnail` → `guardarOriginalMaior` (`apps/web/src/lib/youtube/ab-variant-dhash.ts`), que baixa a maior entre `maxresdefault` (1280×720), `sddefault` (640×480, 4:3) e `hqdefault` (480×360, 4:3) por `biggerCopy`/`probeThumb` (`lib/youtube/thumb-fingerprint.ts`) e grava em `ab-originals/<uuid>.jpg` no Vercel Blob.
- A URL vai para dois lugares: `ab_tests.original_thumbnail_url` e `ab_test_variants.blob_url` da linha `is_original` (com `dimensions` TEXT "LxA" e `thumbnail_dhash`).
- Toda volta da A lê dali: `settleOnAir` usa `fonteDoOriginal(r)` (`lib/youtube/ab-settle.ts`: primeiro `blob_url` da variante original, depois `original_thumbnail_url`, só se for do Blob); rotação e retomada passam `variante.blob_url` a `aplicarRotacao`/`applyVariant` (`ab-rotate-claim.ts`, `ab-resume.ts`, `ab-apply.ts`); o playoff copia `blob_url`/`dimensions` da original do pai em `create_playoff_test` (`supabase/migrations/20260529000001_playoff_mode.sql`).
- `startAbTestInternal` (`lib/youtube/ab-start.ts`, passo 2) relê a thumbnail no ar (`probeThumb`, cota 0) e, se o dHash diverge do `thumbnail_dhash` da original (`hamming > DHASH_MAX_SAME`, 6), **regrava a original com a pública** (`guardarOriginalMaior`). Isto apagaria em silêncio qualquer original enviada: precisa mudar (seção 5.2).
- O único aviso de baixa resolução está no diálogo de encerrar: `originalBaixaResolucao` em `_components/encerrar-props.ts` (largura ≤ 480 ou `dimensions` nulo/ilegível).
- As variantes B/C/D sobem por `uploadVariant` (server action, `FormData`, `put` em `ab-test/<testId>/<label>.<ext>` com `addRandomSuffix: false`, JPEG/PNG por `file.type`, ≤ 2 MB). **Não** tira EXIF, **não** lê dimensões nem proporção do arquivo, confia no MIME do cliente. Por isso a original reusa o armazenamento e a forma da linha das variantes, mas reusa o **processamento de `lib/media`** (`processImage` em `lib/media/process.ts`: `sharp().rotate()`, que tira EXIF; `computeContentHash` em `lib/media/hash.ts`; `sanitizeFilename` em `lib/media/validation.ts`), não a validação fraca do `uploadVariant`.

## 1. Decisões de desenho (resumo)

| # | Decisão | Motivo |
|---|---------|--------|
| D1 | Uma regra só de "pública baixa": largura **< 1280** (`LARGURA_ALTA = 1280`) ou `dimensions` nulo/ilegível. Módulo novo `apps/web/src/lib/youtube/ab-original-resolucao.ts`. | Decisão 1 (Logan): 640×480 e 480×360 são 4:3 com faixa preta. |
| D2 | Envio obrigatório para **iniciar** quando a pública é baixa; a guarda é do servidor, em `startAbTestInternal`, não só da tela. | Decisão 2. `batchStartTests`, a fila e qualquer outra porta de início passam pelo mesmo ponto. |
| D3 | Largura mínima do arquivo: 1280 com a pública baixa, 640 com a pública em alta; 16:9 com tolerância de 1%. | Decisão 3. |
| D4 | Troca da original só com o teste em `draft` ou `paused`. | Decisão 4. |
| D5 | "Remover e usar a pública" só com a pública em alta. | Decisão 5. |
| D6 | JPG, PNG ou GIF, ≤ 2 MB, formato lido dos **bytes** (sharp), não de `file.type`. GIF vira PNG do 1º quadro ao guardar, porque `setThumbnail` só manda `image/png` ou `image/jpeg`. | Decisão 6 e `lib/youtube/ab-youtube.ts`. |
| D7 | Teste já iniciado com a original baixa retoma livre (aviso na ficha); playoff filho de um desses também inicia livre. | Decisão 7. O playoff é continuação do pai. |
| D8 | **Coleta primeiro:** tabela nova `ab_test_originais`, uma linha por cópia guardada ou envio tentado (pública capturada, enviada aceita, enviada recusada). `ab_tests` aponta para a vigente e para a pública. | Regra do dono (coletar mais do que usa); procedência e auditoria sem mexer nas leituras de hoje. |
| D9 | As colunas que todo o código já lê (`ab_tests.original_thumbnail_url`, `ab_test_variants.blob_url`/`dimensions`/`thumbnail_dhash`/`file_size_bytes` da original) passam a refletir a original **vigente**. A troca é atômica numa função SQL. | Reuso: settle, rotação, retomada, nova tentativa, vigia de drift e playoff passam a usar a enviada sem mudar. |
| D10 | O envio **não** escreve no YouTube. Nenhuma cota gasta no envio; a enviada vai ao ar na próxima volta da A. | Escrever agora trocaria a imagem no ar e gastaria cota fora do fluxo de restauração. |
| D11 | Arquivo enviado que some do Blob: a **restauração** (settle) cai para a cópia pública guardada, com marca `motivo: 'original_enviada_ausente'` e alerta; a **rotação** não cai (falha pelo caminho de falha de hoje). O início é recusado. | O sistema falha em verde: a queda tem de ficar visível. Na rotação, trocar a A em silêncio muda a base do experimento. |
| D12 | Envio por rota HTTP (`XMLHttpRequest` com progresso e `abort`), não por server action, porque o cartão E mostra a porcentagem e "Cancelar envio". A lógica fica numa função de `lib` que a rota chama. | Server action não expõe progresso. |
| D13 | A enviada tem de ser **a mesma imagem** da pública (dHash como o YouTube serve, `hamming ≤ DHASH_MAX_SAME`). Caso novo de recusa. [VERIFICAR] com o dono, o Logan e a Naksu: o mockup aprovado tem 4 casos em D, este seria o 5º. | Sem isso, outra imagem viraria a A do experimento e ficaria no ar depois do teste; e o passo 2 do início a acusaria como "mudou no YouTube". |

## 2. Coleta (o que gravar sobre a original)

Tabela `public.ab_test_originais` (uma linha por evento de guarda ou tentativa). Grava inclusive o que ainda não tem tela.

| Coluna | Tipo | Conteúdo |
|--------|------|----------|
| `id` | uuid pk default `gen_random_uuid()` | |
| `site_id` | uuid not null → `sites(id)` | desnormalizado para RLS |
| `test_id` | uuid not null → `ab_tests(id)` on delete cascade | teste em que foi guardada |
| `origem` | text not null check (`'publica'`,`'enviada'`) | |
| `resultado` | text not null default `'aceito'` check (`'aceito'`,`'recusado'`) | recusas também ficam |
| `motivo_recusa` | text null check (`'formato'`,`'tamanho'`,`'proporcao'`,`'pequeno'`,`'ilegivel'`,`'diferente_da_publica'`,`'status_do_teste'`,`'armazenamento'`) | só com `recusado` (check de coerência) |
| `copia_publica` | text null check (`'maxresdefault'`,`'sddefault'`,`'hqdefault'`) | só `publica`: qual cópia o YouTube serviu (exige `guardarOriginalMaior` devolver qual; hoje não devolve) |
| `blob_url`, `blob_pathname` | text null | nulos em recusa |
| `largura`, `altura` | integer null | lidas do arquivo depois de orientar (EXIF), nunca do cliente |
| `formato_recebido` | text null | formato detectado nos bytes (`jpeg`,`png`,`gif`,`webp`,…) |
| `formato_guardado` | text null | `jpeg` ou `png` |
| `bytes_recebidos`, `bytes_guardados` | integer null | |
| `sha256_recebido`, `sha256_guardado` | text null | hex; o guardado é o do arquivo sem EXIF (`computeContentHash`) |
| `dhash` | text null | `dhashDosBytes` (como o YouTube serviria) |
| `dhash_distancia_publica` | smallint null | só `enviada`: hamming contra a pública vigente |
| `largura_publica` | integer null | só `enviada`: largura da pública no momento (prova de qual mínimo valeu) |
| `nome_arquivo` | text null | `sanitizeFilename`, até 120 caracteres |
| `status_do_teste` | text not null | status do teste no momento do envio |
| `enviado_por` | uuid null → `auth.users(id)` on delete set null | nulo nas capturas automáticas; some na fase 3 da LGPD |
| `criado_em` | timestamptz not null default now() | |
| `substituida_em` | timestamptz null | quando deixou de ser a vigente |
| `ausente_desde` | timestamptz null | primeira vez que o Blob respondeu 404 |

Índices: `(test_id, criado_em desc)`; parcial `(site_id) where resultado = 'aceito' and origem = 'enviada'` [VERIFICAR] se alguma leitura precisa dele; senão fica fora.

Em `ab_tests`, duas colunas novas:
- `original_vigente_id uuid null → ab_test_originais(id) on delete set null`
- `original_publica_id uuid null → ab_test_originais(id) on delete set null`

Quem grava linha `publica`: `createAbTest`, `batchStartTests` e o passo 2 de `startAbTestInternal` (quando regrava a pública), sempre depois de `guardarOriginalMaior`. Quem grava linha `enviada`: só `enviarOriginal` (seção 4).

## 3. Migration

`npm run db:new ab_original_em_alta` (nunca à mão). Em uma transação:

1. `create table if not exists public.ab_test_originais (...)` como acima, com os checks.
2. `alter table public.ab_tests add column if not exists original_vigente_id ...`, `original_publica_id ...`.
3. RLS: `alter table public.ab_test_originais enable row level security;` `drop policy if exists "ab_test_originais_select" ...;` `create policy "ab_test_originais_select" on public.ab_test_originais for select using (public.can_edit_site(site_id));` Sem policy de insert/update/delete: só o service role escreve. `can_edit_site`, não `can_view_site`/`can_view_row`, porque a linha traz `enviado_por` e o GUC `app.site_id` é falsificável pelo cliente (memória `reference_rls_guc_spoof_pattern`). `revoke all on public.ab_test_originais from anon;`
4. Backfill idempotente: para cada `ab_tests` com `test_type in ('thumbnail','combo')` e `original_publica_id is null`, inserir uma linha `origem = 'publica'`, `resultado = 'aceito'`, `blob_url` = `blob_url` da variante original (senão `original_thumbnail_url`), `largura`/`altura` lidas de `dimensions` por regex (nulas se ilegível), `dhash` = `thumbnail_dhash`, `status_do_teste` = status atual, `criado_em` = `ab_tests.created_at`; apontar `original_vigente_id` e `original_publica_id` para ela. URL fora do Blob (testes anteriores à P4a) entra igual: a regra de `ehCopiaNoBlob` continua valendo na leitura.
5. Função `public.ab_aplicar_original(p_test_id uuid, p_original_id uuid) returns text`, `security definer`, `set search_path = public`: `select ... for update` no teste; recusa (`'status'`) se `status not in ('draft','paused')` ou se `test_type not in ('thumbnail','combo')`; recusa (`'nao_pertence'`) se a linha não for `aceito` deste `test_id`; senão, na mesma transação: marca `substituida_em = now()` na vigente anterior (se diferente), seta `original_vigente_id`, `original_thumbnail_url = blob_url`, e na variante `is_original` do teste seta `blob_url`, `blob_key = blob_pathname`, `dimensions = largura||'x'||altura`, `thumbnail_dhash = dhash`, `file_size_bytes = bytes_guardados`; devolve `'ok'`. `revoke execute ... from public, anon, authenticated; grant execute ... to service_role;` (sem o grant, o banco local dá SIGSEGV ao chamar, memória `reference_banco_local_integracao`).
6. `create or replace function create_playoff_test(...)`: corpo atual copiado sem mudança, mais `original_vigente_id` e `original_publica_id` do pai no `INSERT INTO ab_tests`. O filho aponta para as linhas do pai (não copia). [VERIFICAR] que `20260529000001_playoff_mode.sql` tem a definição mais recente (o grep só achou essa).
7. `npm run db:push:prod` depois do portão; tipos regenerados em `apps/web/src/types/database.types.ts`.

Sem `restore_seq` na função: a troca só ocorre em `draft`/`paused` e, no pior caso de corrida com uma restauração em curso, a A antiga é escrita uma vez e a nova vai na próxima volta (seção 9).

## 4. Envio e validação no servidor

### 4.1 Módulos

- `apps/web/src/lib/youtube/ab-original-resolucao.ts`: `LARGURA_ALTA = 1280`, `LARGURA_MINIMA_COM_PUBLICA_ALTA = 640`, `PROPORCAO = 16/9`, `TOLERANCIA_PROPORCAO = 0.01`, `MAX_BYTES = 2 * 1024 * 1024`; `publicaBaixa(largura: number | null): boolean`; `larguraMinimaDoEnvio(publicaBaixa: boolean): number`; `dimensoesDeTexto(d: string | null): { largura: number; altura: number } | null`. `originalBaixaResolucao` em `encerrar-props.ts` passa a chamar este módulo [VERIFICAR com o Phil: o README diz que o diálogo segue a regra dele (≤ 480) até ele alinhar; a recomendação deste spec é uma regra só, < 1280].
- `apps/web/src/lib/youtube/ab-original-envio.ts`: `validarArquivoDaOriginal(bytes: Buffer, ctx: { larguraPublica: number | null; dhashPublica: string | null }): Promise<ResultadoValidacao>` (pura sobre bytes, testável sem rede) e `enviarOriginal(portas, { siteId, userId, testId, arquivo })`, que orquestra validação, Blob, linha e `ab_aplicar_original`.
- Rota `apps/web/src/app/api/youtube/ab-tests/[id]/original/route.ts`: `POST` (multipart, campo `file`) e `DELETE` (volta para a pública). `runtime = 'nodejs'` (sharp).

### 4.2 Autorização

Igual às ações do A/B: `getSiteContext()` + `requireSiteScope({ area: 'cms', siteId, mode: 'edit' })` (o padrão de `requireEditUser` em `actions.ts`, que também devolve `userId`), e o teste lido com `.eq('site_id', siteId)` (outro site = 404). Reporter não envia: [VERIFICAR] se `mode: 'edit'` do `@tn-figueiredo/auth-nextjs` já recusa `reporter` (o código do pacote não pôde ser lido nesta sessão); se não recusar, a rota recusa com `user_role() = 'reporter'` → 403 com `siteAdminOnlyMessage`-like "Quem tem papel de repórter não envia a original." Origem da requisição conferida como nas outras rotas do CMS [VERIFICAR qual guarda de CSRF/Origin o middleware aplica a `/api/*` com cookie].

### 4.3 Ordem da validação (cada recusa grava linha `recusado`)

1. Teste existe no site, `test_type ∈ {thumbnail, combo}` (senão 404/422 sem linha).
2. `status ∈ {draft, paused}`; senão 409 `status_do_teste` ("Pause o teste para enviar a original em alta.").
3. `file.size > MAX_BYTES` → `tamanho`, antes de ler o corpo inteiro. Mensagem D4: "<nome> não foi aceito. O arquivo tem 3,4 MB. O limite do YouTube é 2 MB. Comprima e envie de novo."
4. `sharp(bytes).metadata()`: falha → `ilegivel`; `format ∉ {jpeg, png, gif}` → `formato` (D3: "O arquivo é WEBP. Envie JPG, PNG ou GIF.").
5. Dimensões orientadas (EXIF `orientation ≥ 5` troca largura e altura). `|L/A − 16/9| / (16/9) > 0,01` → `proporcao` (D2, com "(4:3)" quando for o caso).
6. `L < larguraMinimaDoEnvio(publicaBaixa(largura_publica))` → `pequeno` (D1: "Com a pública baixa, a original precisa ter 1280 de largura ou mais. Envie um de 1280×720."; com a pública alta, o texto diz 640).
7. Processamento: JPEG/PNG por `processImage(bytes, mime)` de `lib/media/process.ts` (orienta e tira EXIF; o sharp não copia metadados sem `withMetadata`); GIF por `sharp(bytes, { pages: 1 }).png()`. Resultado > 2 MB (PNG pode crescer) → `tamanho` com a mesma mensagem.
8. `dhash = dhashDosBytes(processado)`; distância contra o `dhash` da linha `original_publica_id`. `> DHASH_MAX_SAME` → `diferente_da_publica` (D13) [VERIFICAR texto com o Logan: proposta "<nome> não parece a thumbnail deste vídeo. Envie o arquivo original da thumbnail que está no YouTube."]. Pública sem `dhash` (legado): mede a pública guardada por `dhashDoArquivo` (cota 0); sem base → aceita e grava `dhash_distancia_publica = null`.
9. Mesmo `sha256_guardado` da vigente → devolve `ok` sem gravar nada novo (reenvio idempotente; o "Tentar de novo" de E2 não duplica).
10. `put('ab-originals/<testId>/enviada-<sha256[0..16]>.<jpg|png>', processado, { access: 'public', addRandomSuffix: true, contentType })` (mesmo prefixo e acesso das cópias públicas). Falha → `armazenamento`, 503.
11. Insere a linha `aceito`, chama `ab_aplicar_original`. Recusa da função (`status`, corrida com retomada) → `del(blob)`, a linha vira `recusado`/`status_do_teste`, 409.
12. `revalidateTag('youtube', { expire: 0 })`, `revalidatePath('/cms/youtube/ab-lab')`. Rastro em `audit_log` como as outras ações com `requireEditUser` [VERIFICAR o helper usado hoje para gravar].

Resposta 200: `{ ok: true, original: IOriginalDoTeste }` (seção 6.1). Recusa: `{ ok: false, motivo, mensagem, largura?, altura?, bytes? }` para a tela montar D sem reinterpretar.

`DELETE`: só com `publicaBaixa(publica) === false` (senão 409, D5) e status `draft`/`paused`; chama `ab_aplicar_original(testId, original_publica_id)`. Não apaga o blob da enviada (fica a linha, para histórico).

Nenhuma chamada ao YouTube no envio (D10). Leitura do `i.ytimg.com` só no caso legado do passo 8, cota 0.

## 5. Integração com o início e com a restauração

### 5.1 Toda volta da A usa a vigente

Por D9 a função SQL já reescreve as colunas que o código lê; nenhuma mudança em `aplicarRotacao`, `applyVariant`, `retomarTeste`, `ab-watchdog-nova-tentativa.ts`, `ab-restore-acoes.ts` (P4a/P4b) nem em `create_playoff_test` além do passo 6 da migration. O vigia de drift (`ab-watchdog-drift.ts`) compara o dHash no ar com `thumbnail_dhash` da variante; enviada e pública são a mesma imagem (D13), logo trocar uma pela outra não dispara drift.

### 5.2 `startAbTestInternal` (`lib/youtube/ab-start.ts`)

Antes da reivindicação (`update ... status 'active'`), para `comThumb`:
- Lê `original_vigente_id`, `original_publica_id` e `parent_test_id` com as duas linhas.
- Pública baixa, vigente não é `enviada` e `parent_test_id is null` → `{ ok: false, error: 'Envie a original em alta resolução (1280 de largura ou mais) para iniciar o teste.', codigo: 'original_baixa' }`. Playoff (`parent_test_id` não nulo) segue (D7).
- Vigente `enviada`: `HEAD` no `blob_url` (Blob, cota 0). 404 → grava `ausente_desde` e recusa: "A original enviada não está mais guardada. Envie de novo para iniciar." Erro de rede → recusa como hoje ("Tente de novo"), sem marcar.

No passo 2 (releitura), a comparação passa a ser contra o `dhash` da linha **pública**, não `original.thumbnail_dhash`:
- Vigente `publica` e o no ar mudou: comportamento de hoje (`guardarOriginalMaior`), mais linha nova `publica`, `ab_aplicar_original` para ela; se a nova pública for baixa e não houver enviada → `desfazer('Envie a original em alta ...')`.
- Vigente `enviada` e o no ar mudou: `desfazer('A thumbnail do vídeo mudou no YouTube depois do envio da original. Confira a thumbnail e envie a original de novo.')` [VERIFICAR texto com o Logan]. Nunca regrava por cima da enviada.

A fila (`ab-rotate-phases.ts`, `adiarInicioDaFila`) recebe a recusa e grava o motivo como já faz [VERIFICAR] se o adiamento tem teto ou se repete para sempre; se repetir, o teste em fila com pública baixa precisa de aviso ao dono (`getSiteOwners`) uma vez só.

### 5.3 Arquivo sumiu do Blob (D11)

- `settleOnAir`: `fonteDoOriginal` passa a devolver `{ principal, reserva }` (reserva = `blob_url` da linha pública, se do Blob). Se `fetchVariantImageBuffer(principal)` lança `YouTubeApiError` com `status === 404` e há reserva, escreve a reserva; o campo `thumbnail` fica `estado: 'ok'`, `motivo: 'original_enviada_ausente'` (o `motivo` já é string livre em `CampoRestauracao`; entra na lista comentada em `ab-restore.ts`); grava `ausente_desde`; `Sentry.captureMessage` nível `warning`; aviso ao dono pelo mesmo canal dos avisos de restauração (`ab-restore-avisos.ts`). Sem reserva: falha como hoje.
- Rotação para A com a enviada 404: falha pelo caminho atual (`contaParaFalhas`, pausa pelo vigia); a pausa restaura com a reserva e a marca acima. A ficha (H) mostra "A original enviada não está mais guardada" com "Enviar original" (o teste está pausado).
- Quem apaga do Blob hoje: `deleteVariant` e `cleanupDraftVariants` recusam ou filtram a original (`is_original`, conferido); o `media-cleanup` só varre `media_assets`. Nenhum caminho apaga `ab-originals/`; o 404 é exceção (remoção manual no painel do Blob), mas tem de ser visível.

### 5.4 Encerrar

`encerrar-props.ts` lê `dimensions` da variante original, que agora é a da vigente: com a enviada, o selo "Baixa resolução" some sem mudar o diálogo.

## 6. Tela, rascunho (F) e testes antigos (decisão 7)

### 6.1 Leitura

`queries.ts` ganha `lerOriginalDoTeste(testId): Promise<IOriginalDoTeste | null>` e o detalhe do teste passa a trazer o mesmo objeto:

```ts
interface IOriginalDoTeste {
  origem: 'publica' | 'enviada'
  largura: number | null; altura: number | null; bytes: number | null
  publica: { largura: number | null; altura: number | null; url: string | null }
  publicaBaixa: boolean
  enviadaEm: string | null; enviadaPorMim: boolean; nomeArquivo: string | null
  ausente: boolean
  podeTrocar: boolean      // status draft|paused
  podeUsarPublica: boolean // origem enviada e !publicaBaixa e podeTrocar
}
```

### 6.2 Assistente (`ab-create-wizard.tsx`, `lib/youtube/ab-wizard-reducer.ts`)

- O rascunho nasce na escolha do tipo (`handleTypeSelect` → `createAbTest`), então o envio acontece no passo Variantes, na hora em que o arquivo é escolhido, contra `draftTestId`. `createAbTest` passa a devolver `original: IOriginalDoTeste`.
- Estado novo no reducer: `original: IOriginalDoTeste | null` e `envioOriginal: { fase: 'parado' | 'enviando' | 'caiu' | 'recusado'; progresso: number; arquivo: File | null; recusa: RecusaDaOriginal | null }`; ações `SET_ORIGINAL`, `ENVIO_ORIGINAL_INICIO`, `ENVIO_ORIGINAL_PROGRESSO`, `ENVIO_ORIGINAL_FIM`, `ENVIO_ORIGINAL_CAIU`, `ENVIO_ORIGINAL_RECUSADO`, `ENVIO_ORIGINAL_CANCELADO`. O `File` fica só na memória (não vai a `saveDraft`, que já zera `thumbFile`).
- `stepIsValid(2, state)`: para `thumbnail`/`combo`, além da regra de hoje, `!(state.original?.publicaBaixa && state.original.origem !== 'enviada')` e `envioOriginal.fase !== 'enviando'`. O resumo (G) aplica a mesma função para "Iniciar teste" (aria-disabled + motivo + "Enviar original" que leva ao passo 2 com foco na área).
- "Cancelar envio" (`xhr.abort()`) e "Tentar de novo" (reenvia o `File` guardado na memória): ao cancelar ou cair, a tela relê `lerOriginalDoTeste`; se o servidor terminou antes do abort, mostra C (a verdade é a do servidor).
- E3 do mockup ("O YouTube recusou a imagem ao guardar"): pela D10 o YouTube não é chamado no envio. E3 passa a cobrir `ilegivel` e `armazenamento` [VERIFICAR texto com o Logan; proposta: "Não foi possível guardar este arquivo. Sem a original guardada, o teste não inicia. Tente outro arquivo."].
- F (rascunho reaberto): `existingDraftId` → `lerOriginalDoTeste` no carregamento; `origem === 'enviada'` abre em C com a faixa verde.

### 6.3 Ficha do teste (H, `[testId]`)

Linha "Original guardada" com origem, data e resolução. `publicaBaixa && origem === 'publica'`: `active` → "Pause o teste para enviar a original em alta."; `paused` → aviso + "Enviar original" + Retomar livre (decisão 7: `retomarTeste` não ganha guarda nova). `ausente` → texto da seção 5.3.

### 6.4 Rascunhos antigos

Rascunho criado antes do deploy com pública baixa: o início é novo, logo exige o envio (D2). Rascunho sem `original_publica_id` não existe depois do backfill.

## 7. Cowork e MCP em paridade

- Sem rota nova no pipeline: o pipeline não sobe imagem hoje (o `POST .../ab-tests/:id/variants` só grava texto e metadados), e o envio da original fica no CMS. `api-registry.ts` não muda.
- Leitura em paridade: `lib/pipeline/services/youtube.ts` (lista fechada `CAMPOS_DO_TESTE_QUE_SAEM_COMO_VIERAM`) ganha um objeto derivado `original: { origem, largura, altura, publica_largura, publica_baixa, enviada_em, ausente }` em `GET /api/pipeline/youtube/ab-tests` e `GET .../ab-tests/{id}` (MCP `manage_ab_test` `list_tests`/`get_test`, mesmo serviço). Sem `enviado_por`, sem URL do Blob da enviada.
- Docs: seção "GET /ab-tests/:id e list_tests" de `apps/web/data/pipeline-docs/cowork-docs-youtube.md`; `docs/cowork-pipeline-reference.md` se o esquema da seção mudar; rodar o script de semente (memória `reference_cowork_pipeline_schemas`).
- Cowork e Claude Code leem o mesmo número; nenhum deles inicia teste com pública baixa sem envio porque a guarda está no servidor.

## 8. Critérios de aceite

1. `ab_test_originais` existe com RLS ligada; um usuário sem `can_edit_site` não lê nenhuma linha, inclusive com `app.site_id` falsificado como não-superusuário.
2. Depois do backfill, todo teste `thumbnail`/`combo` tem `original_publica_id = original_vigente_id` apontando para uma linha `publica` com os mesmos `blob_url`, `dhash` e dimensões da variante original.
3. `POST` com JPEG 1920×1080 de 1,2 MB num rascunho com pública 480×360 devolve 200; a variante original passa a ter `blob_url` da enviada, `dimensions = '1920x1080'`; `ab_tests.original_thumbnail_url` igual; a linha `enviada` tem `sha256_*`, `bytes_*`, `largura_publica = 480`, `enviado_por`.
4. O arquivo guardado não tem EXIF (teste com JPEG que carrega GPS e `Orientation = 6`: saída sem `exif`, dimensões orientadas).
5. Recusas, cada uma com linha `recusado` e o `motivo_recusa` certo: WEBP (`formato`), 3,4 MB (`tamanho`), 1200×900 (`proporcao`), 1000×563 com pública baixa (`pequeno`), 1000×563 com pública 1280 (aceito), imagem diferente da pública (`diferente_da_publica`), bytes inválidos com `Content-Type: image/png` (`ilegivel`).
6. GIF 1280×720 é aceito e guardado como PNG de um quadro.
7. Reenvio do mesmo arquivo não cria linha nem blob novo.
8. `POST` em teste `active` ou `completed` → 409, nada gravado no Blob. Usuário de outro site → 404. Reporter → 403 [VERIFICAR 4.2].
9. `DELETE` com pública baixa → 409; com pública 1280×720 e enviada vigente → volta à pública e `podeUsarPublica` vira falso.
10. `startAbTestInternal` com pública baixa e sem enviada devolve `codigo: 'original_baixa'` e não muda status; com a enviada, inicia; playoff filho de pai com pública baixa inicia.
11. Início com a enviada e thumbnail no ar diferente da pública guardada → desfaz para rascunho com a mensagem da 5.2 e não regrava a original.
12. Início com a enviada respondendo 404 → recusa e grava `ausente_desde`.
13. Pausa e encerramento de teste com enviada escrevem no YouTube os bytes da enviada (mock de `setThumbnail` recebe o buffer do blob enviado).
14. Settle com a enviada 404 e reserva pública → escreve a reserva, `restore_status.thumbnail.motivo = 'original_enviada_ausente'`, alerta emitido; sem reserva → `falhou`.
15. O envio não faz chamada a `googleapis.com` (fetch espionado).
16. Assistente: estados A–H do mockup reproduzidos (1440 e 390, claro e escuro); Próximo e Iniciar com `aria-disabled` e motivo nos casos B/E/G; F abre em C.
17. Pipeline: `GET /api/pipeline/youtube/ab-tests/{id}` e `get_test` do MCP trazem o mesmo objeto `original`, sem `enviado_por`.
18. Diálogo de encerrar sem selo "Baixa resolução" quando a vigente é a enviada.

## 9. Roteiro de prova

- **Unit (Vitest, `// @vitest-environment node`):** `ab-original-resolucao.test.ts` (limites 1279/1280, 639/640, tolerância 16:9, `dimensions` nulo); `ab-original-envio.test.ts` com imagens geradas por sharp na hora (critérios 4–7, 15); `ab-start.test.ts` (10–12); `ab-settle.test.ts` (13–14); reducer (`stepIsValid`, transições de envio).
- **Integração no `bythiago_int` (54421/54422, `HAS_LOCAL_DB=1`):** migration aplicada do zero e reaplicada (idempotência); backfill (2); RLS com GUC falsificado (1); `ab_aplicar_original` com status `active` recusado e corrida com `update status` em outra conexão; `create_playoff_test` levando os dois ids.
- **Rota:** `route.test.ts` com `requireSiteScope` simulado (8, 9).
- **Ponta a ponta (Gio):** Playwright no CMS autenticado local, vídeo de semente com pública 480×360 e outro com 1280×720; percorre A–H e compara as capturas com `docs/superpowers/mockups/2026-10-19-ab-original-em-alta/shots/r4-*.png`; mede `scrollWidth` a 390; Tab até a área de envio. Capturas em arquivo, veredito em texto.
- **Real, antes da promoção:** dois vídeos do canal, um com `maxresdefault` e um sem: conferir se `sddefault` vem com faixa preta e se a distância dHash enviada × pública fica ≤ 6 [VERIFICAR, pendência do README].

## 10. Riscos, custos e fora do escopo

Riscos:
- Limiar de D13 calibrado em pares hqdefault × hqdefault; o par arquivo original × hqdefault re-encodado pelo YouTube pode passar de 6 e recusar o arquivo certo. Mitigação: a coleta grava `dhash_distancia_publica` também nas recusas; o roteiro real mede antes.
- Corrida troca × restauração em curso num teste pausado: escreve a A antiga uma vez; aceita (a próxima volta corrige).
- Blob público: a URL da enviada é pública como as das variantes (mesmo modelo de hoje); não é listada em lugar nenhum fora do CMS.
- A original nova não vai ao ar ao ser enviada num teste pausado (D10): até a próxima volta da A, o vídeo segue com a cópia baixa. O texto de C/H não promete o contrário.

Custos:
- Armazenamento: ≤ 2 MB por envio aceito; blobs substituídos não são apagados nesta fase (dezenas de MB por ano no volume atual de testes) [VERIFICAR o volume de testes por mês].
- Cota do YouTube: zero no envio. As escritas da A (`thumbnails.set`, 50 unidades cada [VERIFICAR]) já existem a cada pausa, rotação e encerramento; o número não muda, só o arquivo.
- CPU: um `sharp` de até 2 MB por envio na função da Vercel.

Fora do escopo:
- EXIF e validação real de dimensões no `uploadVariant` das variantes B/C/D (hoje confia em `file.type` e não tira EXIF): lacuna de LGPD registrada para lote próprio; a função `validarArquivoDaOriginal` foi desenhada para ser reusada lá.
- Envio da original pelo Cowork/MCP.
- Aplicar a original no ar na hora do envio.
- Limpeza de blobs substituídos.
- Itens 2 a 5 de `melhorias-pos-ensaio-t19.md`.
