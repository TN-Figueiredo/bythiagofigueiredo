# Spec: original em alta resolução no A/B Lab

Estado: r3, conserto dos achados de Phil e Yannis sobre a r2 (fcfc3e32e), com o ruling do controlador (mínimo de largura do envio = 1280 sempre) e os textos de Logan. Seção 11 "Decisões da r3" lista o que mudou e o porquê; o que ainda espera o dono está marcado `RECOMENDADO, aguarda o dono`.
Requisito: `.superpowers/sdd/ab-lab/original-em-alta/spec-brief.md`.
Tela: `docs/superpowers/mockups/2026-10-19-ab-original-em-alta/` (index.html + README.md, c0c9b2f4e, aprovado pelo dono em 19/10). Decisões do dono: `.superpowers/sdd/ab-lab/original-em-alta/decisoes-dono.md` e as 7 do README.
Problema: item 1 de `.superpowers/sdd/ab-lab/melhorias-pos-ensaio-t19.md` (checkout principal).

## 0. O problema, no código de hoje

- A original de um teste de imagem é a **cópia pública** do YouTube. `createAbTest` e `batchStartTests` (`apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`) chamam `preserveOriginalThumbnail` → `guardarOriginalMaior` (`apps/web/src/lib/youtube/ab-variant-dhash.ts`), que baixa a maior entre `maxresdefault` (1280×720), `sddefault` (640×480, 4:3) e `hqdefault` (480×360, 4:3) por `biggerCopy`/`probeThumb` (`lib/youtube/thumb-fingerprint.ts`) e grava em `ab-originals/<uuid>.jpg` no Vercel Blob.
- A URL vai para dois lugares: `ab_tests.original_thumbnail_url` e `ab_test_variants.blob_url` da linha `is_original` (com `dimensions` TEXT "LxA" e `thumbnail_dhash`).
- Toda volta da A lê dali: `settleOnAir` usa `fonteDoOriginal(r)` (`lib/youtube/ab-settle.ts`: primeiro `blob_url` da variante original, depois `original_thumbnail_url`, só se for do Blob); rotação e retomada passam `variante.blob_url` a `aplicarRotacao`/`applyVariant` (`ab-rotate-claim.ts`, `ab-resume.ts`, `ab-apply.ts`); o playoff copia `blob_url`/`dimensions` da original do pai em `create_playoff_test` (`supabase/migrations/20260529000001_playoff_mode.sql`).
- `startAbTestInternal` (`lib/youtube/ab-start.ts`, passo 2) relê a thumbnail no ar (`probeThumb`, cota 0) e, se o dHash diverge do `thumbnail_dhash` da original (`hamming > DHASH_MAX_SAME`, 6), **regrava a original com a pública** (`guardarOriginalMaior`). Isto apagaria em silêncio qualquer original enviada: precisa mudar (seção 5.2).
- O único aviso de baixa resolução está no diálogo de encerrar: `originalBaixaResolucao` em `_components/encerrar-props.ts` (largura ≤ 480 ou `dimensions` nulo/ilegível).
- As variantes B/C/D sobem por `uploadVariant` (server action, `FormData`, `put` em `ab-test/<testId>/<label>.<ext>` com `addRandomSuffix: false`, JPEG/PNG por `file.type`, ≤ 2 MB). **Não** tira EXIF, **não** lê dimensões nem proporção do arquivo, confia no MIME do cliente. Por isso a original reusa o armazenamento e a forma da linha das variantes, mas **não** o `processImage` de `lib/media/process.ts` (`sharp(buffer).rotate().toBuffer()` sem opção de saída: reencoda JPEG em qualidade 80, 4:2:0, e degradaria a "original em alta"). Reusa só `computeContentHash` (`lib/media/hash.ts`) e `sanitizeFilename` (`lib/media/validation.ts`); o processamento é próprio (seção 4.3 passo 7). Também não reusa a validação fraca do `uploadVariant`.
- Fato de produção (19/10, leitura): 3 originais, todas de testes `combo`. Duas com `dimensions` NULL (uma `completed` com `blob_url` fora do Vercel Blob, uma `archived`); uma `completed` 480x360 com dhash. Nenhuma está em `draft`/`paused`: o backfill e a regra "nulo ≠ medido" (D1, seção 3 passo 4) é que as tratam.

## 1. Decisões de desenho (resumo)

| # | Decisão | Motivo |
|---|---------|--------|
| D1 | Uma regra só de "baixa": largura **< 1280** (`LARGURA_ALTA = 1280`) ou largura nula/0/ilegível (nulo ≠ medido). Vale para a pública no início e para a **vigente** no diálogo de encerrar (`originalBaixaResolucao` chama o mesmo módulo; o comentário "Ruling do Phil (T15)" e a regra ≤ 480 saem). Módulo novo `apps/web/src/lib/youtube/ab-original-resolucao.ts`. | Decisão 1 (Logan): 640×480 e 480×360 são 4:3 com faixa preta; `sddefault` veio 640×480 nos 6 vídeos medidos pelo Phil em 19/10. |
| D2 | Envio obrigatório para **iniciar** quando a pública é baixa; a guarda é do servidor, em `startAbTestInternal`, não só da tela. | Decisão 2. `batchStartTests`, a fila e qualquer outra porta de início passam pelo mesmo ponto. |
| D3 | Largura mínima do arquivo: **1280 sempre**, com a pública baixa ou alta; 16:9 com tolerância de 1%. | Decisão 3 do dono (1280 com a pública baixa) estendida pelo ruling do controlador (19/10): o envio nunca piora a A, e há um número só. Supera o mínimo menor com a pública alta da r2 e do README do mockup. |
| D4 | Envio/troca da original só com o teste em `draft`, `paused` ou `queued` (o teste `queued` não está no ar; a fila o devolve a `draft` antes de iniciar, e a função trava a linha com `for update`). `active` só pela via do início, com `p_restore_seq` (seção 3 passo 5). | Decisão 4, ajustada em B1/B2 da r1: sem `queued` o teste ficava sem saída. |
| D5 | "Remover e usar a pública" só com a pública em alta. | Decisão 5. |
| D6 | JPG, PNG ou GIF, ≤ 2 MB, formato lido dos **bytes** (sharp), não de `file.type`. GIF vira PNG do 1º quadro ao guardar, porque `setThumbnail` só manda `image/png` ou `image/jpeg`. | Decisão 6 e `lib/youtube/ab-youtube.ts`. |
| D7 | Teste já iniciado com a original baixa retoma livre (aviso na ficha); playoff filho de um desses também inicia livre. | Decisão 7. O playoff é continuação do pai. |
| D8 | **Coleta primeiro:** tabela nova `ab_test_originais`, uma linha por cópia guardada ou envio tentado (pública capturada, enviada aceita, enviada recusada). `ab_tests` aponta para a vigente e para a pública. | Regra do dono (coletar mais do que usa); procedência e auditoria sem mexer nas leituras de hoje. |
| D9 | As colunas que todo o código já lê (`ab_tests.original_thumbnail_url`, `ab_test_variants.blob_url`/`dimensions`/`thumbnail_dhash`/`file_size_bytes` da original) passam a refletir a original **vigente**. A troca é atômica numa função SQL. | Reuso: settle, rotação, retomada, nova tentativa, vigia de drift e playoff passam a usar a enviada sem mudar. |
| D10 | O envio **não** escreve no YouTube. Nenhuma cota gasta no envio; a enviada vai ao ar na próxima volta da A. | Escrever agora trocaria a imagem no ar e gastaria cota fora do fluxo de restauração. |
| D11 | Arquivo enviado que some do Blob: a **restauração** (settle) cai para a cópia pública guardada, com marca `motivo: 'original_enviada_ausente'` e alerta; a **rotação** não cai: o 404 da variante original vai a `settleOnAir` com `motivo: 'original_enviada_ausente'` (pausa e restaura com a reserva, seção 5.3); a **retomada** manual e a **nova tentativa do vigia** têm caminho próprio (5.3). O início é recusado. Nenhum caminho que lê a original falha calado. | O sistema falha em verde: a queda tem de ficar visível. Na rotação, trocar a A em silêncio muda a base do experimento. |
| D14 | Registro e troca na **mesma transação**: `ab_registrar_original(...)` insere a linha e aplica (seção 3 passo 5). Linha `aceito` nunca existe sem ter sido vigente. | Phil C4: a gravação em passos deixava `original_publica_id` nulo e linha `aceito` que nunca valeu. |
| D12 | Envio por rota HTTP (`XMLHttpRequest` com progresso e `abort`), não por server action, porque o cartão E mostra a porcentagem e "Cancelar envio". A lógica fica numa função de `lib` que a rota chama. | Server action não expõe progresso. |
| D13 | A enviada tem de ser **a mesma imagem** da pública (dHash como o YouTube serve, `hamming ≤ DHASH_MAX_SAME`). Caso novo de recusa. **RECOMENDADO, aguarda o dono** (Logan, 19/10: recusar): o mockup aprovado tem 4 casos em D, este é o 5º ("não é a mesma imagem", dHash > 6). Texto: "<nome> não foi aceito. Não parece a mesma imagem da thumbnail atual do vídeo. Envie o arquivo original dessa thumbnail." Medido por Phil (19/10, 6 vídeos, `i.ytimg.com`): maxres×hq 0 a 2, sd×hq 0 a 4, "enviada" (maxres ampliada a 1920, q92) × hq 0 a 2; o limiar 6 cabe com folga; **antes da promoção, medir com o arquivo-mestre real do dono** (Phil mediu 0 a 4 contra o limiar 6, em proxies). | Sem isso, outra imagem viraria a A do experimento e ficaria no ar depois do teste; e o passo 2 do início a acusaria como "mudou no YouTube". |

## 2. Coleta (o que gravar sobre a original)

Tabela `public.ab_test_originais` (uma linha por evento de guarda ou tentativa). Grava inclusive o que ainda não tem tela.

| Coluna | Tipo | Conteúdo |
|--------|------|----------|
| `id` | uuid pk default `gen_random_uuid()` | |
| `site_id` | uuid not null → `sites(id)` | desnormalizado para RLS |
| `test_id` | uuid not null → `ab_tests(id)` on delete cascade | teste em que foi guardada |
| `origem` | text not null check (`'publica'`,`'enviada'`) | |
| `registro` | text not null default `'captura'` check (`'captura'`,`'envio'`,`'backfill'`) | `backfill` = linha criada pela migration ou por `ab_garantir_original_publica` a partir do que já existia, nunca medida na captura; `envio` = tentativa de envio; `captura` = pública capturada pelo app |
| `copiada_de` | uuid null → `ab_test_originais(id)` on delete set null | linha copiada de outro teste (playoff) |
| `resultado` | text not null default `'aceito'` check (`'aceito'`,`'recusado'`) | recusas também ficam |
| `motivo_recusa` | text null check (`'formato'`,`'tamanho'`,`'proporcao'`,`'pequeno'`,`'ilegivel'`,`'diferente_da_publica'`,`'status_do_teste'`,`'armazenamento'`) | só com `recusado` (check de coerência) |
| `copia_publica` | text null check (`'maxresdefault'`,`'sddefault'`,`'hqdefault'`) | só `publica`: qual cópia o YouTube serviu (exige `guardarOriginalMaior` devolver qual; hoje não devolve) |
| `blob_url`, `blob_pathname` | text null | nulos em recusa |
| `largura`, `altura` | integer null, check (`largura is null or largura > 0`, idem altura) | lidas do arquivo depois de orientar (EXIF), nunca do cliente. **Nulas quando não medidas; 0 nunca é gravado** (`guardarOriginalMaior` hoje devolve `meta.width ?? 0` em `ab-variant-dhash.ts:94`: passa a devolver `null`) |
| `formato_recebido` | text null | formato detectado nos bytes (`jpeg`,`png`,`gif`,`webp`,…) |
| `formato_guardado` | text null | `jpeg` ou `png` |
| `bytes_recebidos`, `bytes_guardados` | integer null | `bytes_recebidos` vem do arquivo, ou do `Content-Length` quando o corpo é recusado antes de `formData()` |
| `sha256_recebido`, `sha256_guardado` | text null | hex (`computeContentHash`). JPEG já limpo é guardado byte a byte (`sha256_guardado = sha256_recebido`); a idempotência compara `sha256_recebido` (o guardado muda se a versão do sharp mudar) |
| `dhash` | text null | `dhashDosBytes` (como o YouTube serviria) |
| `dhash_distancia_publica` | smallint null | só `enviada`: hamming contra a pública vigente |
| `largura_publica` | integer null | só `enviada`: largura da pública no momento (prova de qual mínimo valeu) |
| `nome_arquivo` | text null | `sanitizeFilename`, até 120 caracteres |
| `status_do_teste` | text not null | status do teste no momento do envio; no backfill, `'draft'` (toda captura acontece no rascunho), nunca o status atual |
| `enviado_por` | uuid null → `auth.users(id)` on delete set null | nulo nas capturas automáticas; some na fase 3 da LGPD |
| `criado_em` | timestamptz not null default now() | |
| `substituida_em` | timestamptz null | quando deixou de ser a vigente |
| `ausente_desde` | timestamptz null | primeira vez que o Blob respondeu 404 |

Índice: `(test_id, criado_em desc)`. O índice parcial `(site_id) where ... enviada` fica fora: nenhuma leitura do spec o usa.

Em `ab_tests`, duas colunas novas:
- `original_vigente_id uuid null → ab_test_originais(id) on delete set null`
- `original_publica_id uuid null → ab_test_originais(id) on delete set null`

Quem grava linha `publica`: `createAbTest`, `batchStartTests` e o passo 2 de `startAbTestInternal` (quando regrava a pública), sempre depois de `guardarOriginalMaior` (que passa a devolver `copia`, qual das três o YouTube serviu), **pela função `ab_registrar_original`** (seção 3 passo 5): o teste e as variantes são criados antes, a linha e os dois ids numa transação só; se a função falhar, `createAbTest` apaga o teste (cascata leva a linha), como hoje. Quem grava linha `enviada`: só `enviarOriginal` (seção 4), pela mesma função.

## 3. Migration

`npm run db:new ab_original_em_alta` (nunca à mão). Em uma transação:

1. `create table if not exists public.ab_test_originais (...)` como acima, com os checks.
2. `alter table public.ab_tests add column if not exists original_vigente_id ...`, `original_publica_id ...`.
3. RLS: `alter table public.ab_test_originais enable row level security;` `drop policy if exists "ab_test_originais_select" ...;` `create policy "ab_test_originais_select" on public.ab_test_originais for select using (public.can_edit_site(site_id));` Sem policy de insert/update/delete: só o service role escreve. `can_edit_site`, não `can_view_site`/`can_view_row`, porque a linha traz `enviado_por` e o GUC `app.site_id` é falsificável pelo cliente (memória `reference_rls_guc_spoof_pattern`). `revoke all on public.ab_test_originais from anon;` e `revoke insert, update, delete on public.ab_test_originais from authenticated;` (segunda tranca: o Supabase concede tudo a `authenticated` em tabela nova).
4. Função `public.ab_garantir_original_publica(p_test_id uuid) returns uuid`, idempotente, `security definer`. **Começa com `select ... from ab_tests where id = p_test_id for update` e relê `original_publica_id` depois da trava** (a guarda do início, `lerOriginalDoTeste` e a fila podem chamá-la juntas; sem a trava inseririam duas linhas `publica`). Se o teste é `thumbnail`/`combo` e `original_publica_id is null`, insere uma linha `origem = 'publica'`, `resultado = 'aceito'`, `registro = 'backfill'`, `status_do_teste = 'draft'`, `blob_url` = `blob_url` da variante original (senão `original_thumbnail_url`), `largura`/`altura` lidas de `dimensions` por regex **só se > 0** (senão nulas), `dhash` = `thumbnail_dhash`, `copia_publica` inferida da largura (1280 `maxresdefault`, 640 `sddefault`, 480 `hqdefault`, outra ou nula: nulo; só vale com a marca `backfill`), `criado_em` = `ab_tests.created_at`; aponta `original_vigente_id` e `original_publica_id` para ela (se `original_vigente_id` já existe, não mexe nele); devolve o id. Com o id já preenchido, devolve-o sem inserir. O **backfill** da migration chama a função para cada teste `thumbnail`/`combo` sem `original_publica_id` (O(T), uma consulta por teste; dezenas hoje, centenas em 1 ano). Fatos de produção (19/10): as 3 originais entram assim; as 2 de `dimensions` NULL ficam com `largura`/`altura` nulas e as de blob fora do Vercel Blob mantêm a URL (a regra `ehCopiaNoBlob` continua valendo na leitura); a 480x360 vira `copia_publica = 'hqdefault'` com marca de backfill. Nenhuma das 3 está em `draft`/`paused`, então nada é exigido delas; `publicaBaixa(null)` é verdadeiro, o que só acende o selo na ficha e no diálogo de encerrar (D1).
5. Funções de escrita, todas `security definer`, `set search_path = public`, `revoke execute ... from public, anon, authenticated; grant execute ... to service_role;` (sem o grant, o banco local dá SIGSEGV ao chamar, memória `reference_banco_local_integracao`):
   - `ab_aplicar_original(p_test_id uuid, p_original_id uuid, p_restore_seq integer default null) returns text`. `restore_seq` é `integer` (`20261014000005_ab_restore_status.sql:32`). `select ... for update` no teste. Recusa `'status'` se `test_type not in ('thumbnail','combo')`. **Sem `p_restore_seq`:** exige `status in ('draft','paused','queued')`. **Com `p_restore_seq`:** exige `status = 'active' and restore_seq = p_restore_seq` (o `seq` que o início reivindicou) e que a linha seja `origem = 'publica'`; é o único caminho que aceita `active`. Recusa `'nao_pertence'` se a linha não for `aceito` deste `test_id`. Senão, na mesma transação: `substituida_em = now()` na vigente anterior (se diferente), **`substituida_em = null` na linha que vira vigente** (o `DELETE` que volta à pública reabre uma linha que já foi vigente; sem isso o histórico mente), seta `original_vigente_id` (e, para linha `publica`, `original_publica_id`), `original_thumbnail_url = blob_url`, e na variante `is_original` seta `blob_url`, `blob_key = blob_pathname`, `dimensions = largura||'x'||altura` (**nulo se largura ou altura nulas**), `thumbnail_dhash = dhash`, `file_size_bytes = bytes_guardados`. `get diagnostics`: se o teste tem variante `is_original` e a atualização tocou zero linhas, `raise` (o playoff pode não ter variante original: nesse caso só `ab_tests.original_thumbnail_url` é atualizado, declarado). Devolve `'ok'`.
   - `ab_registrar_original(p_test_id uuid, p_linha jsonb, p_aplicar boolean, p_restore_seq integer default null) returns jsonb` devolve `{ resultado, original_id }`. **Não confia no JSON:** `site_id` e `test_id` vêm do teste lido por `p_test_id` (sobrescrevem o que o JSON trouxer); `origem` é validada (com `p_restore_seq` só `publica`); `id`, `substituida_em` e `ausente_desde` do JSON são ignorados. Insere a linha e, com `p_aplicar`, chama a lógica de `ab_aplicar_original` **na mesma transação**; se a aplicação recusa (`status`, `nao_pertence`), grava a linha como `recusado` com o motivo (`status_do_teste`) e devolve a recusa, sem deixar linha `aceito` que nunca valeu. A recusa `nao_pertence` grava `motivo_recusa = 'status_do_teste'` (o check de `motivo_recusa` não tem outro valor adequado; declarado). Ordem do envio: `put` → função; recusa ou erro → `del(blob)` (seção 4.3 passo 12). `createAbTest`, `batchStartTests` e o passo 2 do início chamam esta função.
6. `create_playoff_test(...)`: corpo atual (`20260529000001_playoff_mode.sql:29`, única definição, confirmada por grep em todas as migrations) sem mudança, mais: **chama `ab_garantir_original_publica(pai)` antes da cópia** (pai legado sem `original_publica_id` copiaria zero linhas); **copia** as linhas vigente e pública do pai para o filho (`insert ... select` com `test_id = v_new_test_id`, mesma `blob_url`, `criado_em` original, `copiada_de` = id da linha do pai) e aponta `original_vigente_id`/`original_publica_id` do filho para as **cópias**. A regra "pertence ao teste" fica verdadeira, o `DELETE` do filho funciona e a cascata de `test_id` do pai não zera os ids do filho. O playoff não copia `thumbnail_dhash` hoje: passa a copiar também o `thumbnail_dhash` da linha vigente para a variante `is_original` do filho (menor do Phil); com a linha pública copiada, o passo 2 do início passa a ter base. Quando o pai tem uma só linha (vigente = pública), a cópia é uma só e os dois ids apontam para ela.
7. `npm run db:push:prod` depois do portão; tipos regenerados em `apps/web/src/types/database.types.ts`. Conferências do dia do push: `select count(*) from ab_tests where test_type in ('thumbnail','combo') and original_publica_id is null` = 0 (rodar de novo depois do deploy da Vercel: a janela entre migration e código deixa `createAbTest` antigo criar teste sem linha); `select count(*) from ab_test_originais where registro = 'backfill'` = 3 hoje; variante original × vigente sem divergência de `blob_url`/`dhash` = 0 linhas.

A função **não** soma 1 em `restore_seq` no envio (fora do início): a corrida envio × restauração em curso num teste `paused` escreve a A antiga uma vez e a nova vai na próxima volta. Dívida declarada (seção 10); só se paga junto com um teste de integração que prove que o vigia retoma o settle interrompido.



## 4. Envio e validação no servidor

### 4.1 Módulos

- `apps/web/src/lib/youtube/ab-original-resolucao.ts`: `LARGURA_ALTA = 1280` (limiar de "baixa" **e** mínimo do envio, sem outra constante), `PROPORCAO = 16/9`, `TOLERANCIA_PROPORCAO = 0.01`, `MAX_BYTES = 2 * 1024 * 1024`; `publicaBaixa(largura: number | null | undefined): boolean` (nulo, 0 ou < 1280 = baixa); `dimensoesDeTexto(d: string | null): { largura: number; altura: number } | null`. `originalBaixaResolucao` em `encerrar-props.ts` passa a chamar `publicaBaixa(dimensoesDeTexto(d)?.largura ?? null)` (ruling do Phil, 19/10: regra única < 1280 também no diálogo; resolve o alinhamento que o README deixava aberto).
- `apps/web/src/lib/youtube/ab-original-envio.ts`: `validarArquivoDaOriginal(bytes: Buffer, ctx: { larguraPublica: number | null; dhashPublica: string | null }): Promise<ResultadoValidacao>` (pura sobre bytes, testável sem rede; usa `sharp(bytes, { limitInputPixels: 40_000_000 })`) e `enviarOriginal(portas, { siteId, userId, testId, arquivo })`, que orquestra validação, Blob e `ab_registrar_original`.
- Rota `apps/web/src/app/api/youtube/ab-tests/[id]/original/route.ts`: `POST` (multipart, campo `file`) e `DELETE` (volta para a pública). `runtime = 'nodejs'` (sharp). `maxDuration` fixado depois de medir o mozjpeg q95 4:4:4 num JPEG sujo de 12 Mpx (a estimativa de 100 a 300 ms não está medida; Yannis, menor b).

### 4.2 Autorização

Igual às ações do A/B, na ordem, no topo de `POST` e de `DELETE`:
1. `assertSameOriginFetch(req)` de `apps/web/src/lib/oauth/origin.ts:117` (recusa `sec-fetch-site` `cross-site` e `same-site` com 403; header ausente permite). Fato: nenhum middleware aplica guarda de origem a `/api/*`, e o cookie de sessão é `sameSite: 'lax'`, que um subdomínio irmão (`go.<domínio>`) usa. O XHR do CMS manda `same-origin`.
2. `getSiteContext()` + `requireSiteScope({ area: 'cms', siteId, mode: 'edit' })` (precedente da rota `src/app/api/youtube/poll-stats/route.ts`; `userId` como `requireEditUser` em `actions.ts`), e o teste lido com `.eq('site_id', siteId)` (outro site = 404). Fato: `requireSiteScope` com `mode: 'edit'` chama `can_edit_site` (`auth-nextjs/dist/server/require-site-scope.js:3-7`), que só aceita `super_admin`, `org_admin` e `editor` (`20260507000001_schema.sql:3760-3767`); `reporter` recebe `insufficient_access` → 403 sem ramo extra.
3. Rastro em `audit_log` por insert direto, como `ab-restore-acoes.ts:53-58`: `actor_user_id`, `org_id`, `site_id`, `action: 'ab_original_enviada' | 'ab_original_publica_restaurada'`, `resource_type: 'ab_test'`, `resource_id`, `after_data` sem URL do Blob. Falha do rastro vai ao log e não desfaz.

### 4.3 Ordem da validação (cada recusa que chega ao código grava linha `recusado`)

Ordem única (Phil e Yannis da r2): o teste é lido **antes de qualquer recusa gravada** (a linha exige `site_id` e `status_do_teste` não nulos); as dimensões são lidas **antes** de proporção e mínimo.

1. Lê o teste no site; `test_type ∈ {thumbnail, combo}` (senão 404/422, sem linha).
2. `status ∈ {draft, paused, queued}`; senão 409 `status_do_teste` ("Pause o teste para enviar a original em alta."). Um 409 de status ganha de um 413.
3. **Limite de corpo da Vercel (4,5 MB).** Decisão: manter a rota multipart (não usar client upload com token). Motivo: o teto da original é 2 MB, então arquivo acima de 4,5 MB é sempre recusa; client upload com token trocaria a validação do servidor por validação depois do armazenamento e exigiria rota de token e limpeza do que sobrasse no Blob. Três camadas: (a) a tela recusa `file.size > MAX_BYTES` antes de enviar, com a mensagem D4; (b) a rota lê `Content-Length` (já com o teste lido) antes de `formData()`: `> MAX_BYTES + 64 KiB` → 413 JSON `{ ok: false, motivo: 'tamanho', bytes }` e linha `recusado` com `bytes_recebidos` do cabeçalho; (c) acima de 4,5 MB a plataforma responde 413 sem JSON e **sem linha** (declarado no critério 5): o XHR mapeia 413 sem JSON para `tamanho`.
4. Depois de `formData()` e antes do sharp: `file.size > MAX_BYTES` → `tamanho`. Mensagem D4: "<nome> não foi aceito. O arquivo tem 3,4 MB. O limite do YouTube é 2 MB. Comprima e envie de novo."
5. `sharp(bytes, { limitInputPixels: 40_000_000 }).metadata()`: falha ou excesso de pixels (um PNG de 2 MB pode declarar 16k×16k) → `ilegivel` ("<nome> não foi aceito. Não foi possível ler o arquivo. Tente outro arquivo."); `format ∉ {jpeg, png, gif}` → `formato` (D3: "O arquivo é WEBP. Envie JPG, PNG ou GIF.").
6. **Processamento próprio** (sem `processImage`; seção 0). As dimensões orientadas vêm daqui (uma fonte só, sem o cálculo manual de `orientation ≥ 5`): do `info` da saída, ou, no JPEG limpo sem processamento, de `metadata()` (orientação 1 garantida).
   - JPEG **já limpo** (orientação EXIF 1 ou ausente, `!meta.exif && !meta.xmp && !meta.iptc`, `meta.space` em `srgb` ou `b-w`, sem `comments`; ICC sozinho fica: é cor, não é dado pessoal): grava os **bytes recebidos**, sem recompressão. `sha256_guardado = sha256_recebido`.
   - JPEG sujo (EXIF/XMP/IPTC, orientação, ou `space` fora de `srgb`/`b-w`, p.ex. CMYK, que o YouTube e os navegadores tratam mal; ou `comments`): `sharp(bytes, { limitInputPixels }).rotate().toColorspace('srgb').jpeg({ quality: 95, chromaSubsampling: '4:4:4', mozjpeg: true })`; se passar de 2 MB, uma segunda tentativa com `quality: 90` antes de recusar por `tamanho`. q95 4:4:4 mantém o arquivo do dono visualmente intacto (q80 4:2:0 é o padrão do sharp que a r1 apontou); q90 só como último recurso para caber no limite do YouTube. Limite conhecido: o segmento COM de JPEG que o sharp não expõe em `metadata()` passa num JPEG limpo (texto livre, não dado estruturado; declarado, seção 10).
   - PNG: `sharp(bytes, { limitInputPixels }).rotate().png({ compressionLevel: 9 })` (sempre; sem perda, descarta chunks de texto/EXIF que o sharp não expõe em `metadata()`).
   - GIF: `sharp(bytes, { pages: 1, limitInputPixels }).png()`.
   - Resultado > 2 MB → `tamanho` com a mesma mensagem.
7. Proporção, sobre as dimensões do passo 6: `|L/A − 16/9| / (16/9) > 0,01` → `proporcao` (D2, com "(4:3)" quando for o caso).
8. Mínimo, **1280 sempre**: `L < LARGURA_ALTA` → `pequeno` ("<nome> não foi aceito. O arquivo tem 1000×563. A original precisa ter 1280 de largura ou mais. Envie um de 1280×720."; no mockup D1 a frase abre com "Com a pública baixa,", que continua verdadeira e vale também com a pública alta). `largura_publica` segue gravada como prova.
9. `dhash = dhashDosBytes(processado)`; distância contra o `dhash` da linha `original_publica_id`. `> DHASH_MAX_SAME` → `diferente_da_publica` (D13; **RECOMENDADO, aguarda o dono**; texto de Logan: "<nome> não foi aceito. Não parece a mesma imagem da thumbnail atual do vídeo. Envie o arquivo original dessa thumbnail."). Pública sem `dhash` (legado): mede a pública guardada por `dhashDoArquivo` (cota 0); sem base → aceita e grava `dhash_distancia_publica = null`.
10. Mesmo `sha256_recebido` da vigente → devolve `ok` sem gravar nada novo (reenvio idempotente; o "Tentar de novo" de E2 não duplica). Lido fora da trava: dois envios iguais em duas abas criam duas linhas e dois blobs; inofensivo (a segunda vira vigente), declarado.
11. `put('ab-originals/<testId>/enviada-<sha256[0..16]>.<jpg|png>', processado, { access: 'public', addRandomSuffix: true, contentType })`. Falha → `armazenamento`, 503 ("O envio de <nome> não foi concluído e a original não foi guardada. Tente de novo.").
12. Tudo depois do `put` fica em `try { ab_registrar_original(...) } catch { await del(url).catch(Sentry.captureException); throw }`: insert que falha, exceção do RPC, timeout e recusa da função (`status`, corrida com retomada) apagam o blob órfão. Na recusa da função a linha vira `recusado`/`status_do_teste` (a própria função grava), 409. Blob órfão só resta se o processo morrer antes do `catch` (2 MB, raro, declarado na seção 10).
13. `revalidateTag('youtube', { expire: 0 })`, `revalidatePath('/cms/youtube/ab-lab')`; rastro em `audit_log` (seção 4.2).

Resposta 200: `{ ok: true, original: IOriginalDoTeste }` (seção 6.1). Recusa: `{ ok: false, motivo, mensagem, largura?, altura?, bytes? }` para a tela montar D sem reinterpretar.

`DELETE`: só com `publicaBaixa(publica) === false` (senão 409, D5) e status `draft`/`paused`/`queued`; chama `ab_aplicar_original(testId, original_publica_id)` (no playoff a linha pública é a cópia do próprio filho). Não apaga o blob da enviada (fica a linha, para histórico).

Nenhuma chamada ao YouTube no envio (D10). Leitura do `i.ytimg.com` só no caso legado do passo 9, cota 0.

## 5. Integração com o início e com a restauração

### 5.1 Toda volta da A usa a vigente

Por D9 a função SQL já reescreve as colunas que o código lê; nenhuma mudança em `aplicarRotacao`, `applyVariant`, `retomarTeste`, `ab-watchdog-nova-tentativa.ts`, `ab-restore-acoes.ts` (P4a/P4b) nem em `create_playoff_test` além do passo 6 da migration. O vigia de drift (`ab-watchdog-drift.ts`) compara o dHash no ar com `thumbnail_dhash` da variante; enviada e pública são a mesma imagem (D13), logo trocar uma pela outra não dispara drift.

### 5.2 `startAbTestInternal` (`lib/youtube/ab-start.ts`)

Antes da reivindicação (`update ... status 'active'`, linha ~282), para `comThumb`:
- Lê `original_vigente_id`, `original_publica_id` e `parent_test_id` com as duas linhas; se `original_publica_id` é nulo (teste criado por `createAbTest` antigo na janela entre `db:push:prod` e o deploy), chama `ab_garantir_original_publica(testId)` na hora.
- Pública baixa, vigente não é `enviada` e `parent_test_id is null`: antes de recusar, **a guarda sonda** `probeThumb(youtubeVideoId, null)` (cota 0). Sonda sem `dhash` (falha de leitura) → recusa "Tente de novo", nunca segue nem cai em `original_baixa`. dHash diferente do da linha pública → segue para a reivindicação e o passo 2 decide (a pública no ar mudou e pode ser alta agora); igual → `{ ok: false, error: 'Envie a original em alta resolução (1280 de largura ou mais) para iniciar o teste.', codigo: 'original_baixa' }`, status intocado. Playoff (`parent_test_id` não nulo) segue (D7).
- Vigente `enviada`: `HEAD` no `blob_url` (Blob, cota 0). 404 → grava `ausente_desde` (só se nulo) e recusa: "A original enviada não está mais guardada. Envie de novo para iniciar." Erro de rede → recusa como hoje ("Tente de novo"), sem marcar.

No passo 2 (releitura, **depois** da reivindicação `active`), a comparação passa a ser contra o `dhash` da linha **pública**, não `original.thumbnail_dhash`:
- Vigente `publica` e o no ar mudou: `guardarOriginalMaior`, e **a escrita é `ab_registrar_original(testId, linha publica, p_aplicar = true, p_restore_seq = seq)`** com o `seq` da reivindicação (substitui o `update` sem guarda de `ab_test_variants` de hoje, `ab-start.ts:333-337`). Recusa da função → `desfazer(MSG_EM_ANDAMENTO)`. Se a nova pública for baixa e não houver enviada → `desfazer('Envie a original em alta ...')`. Sem esse `p_restore_seq`, a função recusaria `active` e o início se desfaria para sempre.
- Vigente `enviada` e o no ar mudou: `desfazer('A thumbnail do vídeo mudou no YouTube depois do envio da original. Confira a thumbnail atual e envie a original de novo.')` (texto de Logan, aplicado; a ficha H usa a mesma frase). Nunca regrava por cima da enviada.

**Fila (`ab-rotate-phases.ts`).** Fato: `adiarInicioDaFila` põe o teste em `queued`, avisa uma vez por dia e desiste na 7ª (`MAX_TENTATIVAS_DA_FILA = 7`); a recusa `original_baixa` é determinística. Em `processQueuedTests`, `codigo: 'original_baixa'` **sai da fila na hora**: `update config = config || { queue_start_failures: 7 }` mantendo `draft`; `queue_start_after` **continua nulo** (o claim já o zerou; o teste perde a data, e o aviso diz isso), aviso único (`dedupKey: ab-queue-original:<id>`, "envie a original em alta para iniciar"). `startAbTestInternal` devolve `codigo` e a fila lê. O teste em `queued` também aceita envio (D4), então nenhum teste fica sem saída.

### 5.3 Arquivo sumiu do Blob (D11): todos os caminhos que leem a original

Fato: `fetchVariantImageBuffer` lança `YouTubeApiError(404, 'blob_404', 'blob')` (`ab-youtube.ts:119`); `contaParaFalhas` exclui `chamada === 'blob'` e `contarFalhaDaRotacao` sai antes de contar (`MOTIVO_DO_STATUS[404]` não existe). Hoje isso é silêncio; a r1 supôs o contrário.

- **`settleOnAir`** (pausa, encerrar, reverter, nova tentativa do vigia via `tentar`): `fonteDoOriginal` passa a devolver `{ principal, reserva }` (reserva = `blob_url` da linha pública, se do Blob). Se `fetchVariantImageBuffer(principal)` lança 404 e há reserva, escreve a reserva; o campo `thumbnail` fica `estado: 'ok'`, `motivo: 'original_enviada_ausente'` (`motivo` já é string livre em `CampoRestauracao`; entra na lista comentada de `ab-restore.ts`); grava `ausente_desde` (**só se nulo**, `.is('ausente_desde', null)`, para guardar a primeira vez); `Sentry.captureMessage` `warning`; aviso ao dono pelo canal de `ab-restore-avisos.ts` com `claimAlert(supabase, 'ab-original-ausente:<testId>', '30 days')` (um por teste). Sem reserva: falha como hoje. Novo envio aceito zera o estado (a linha nova não tem `ausente_desde`).
- **Rotação para a A (`ab-rotate-phases.ts`)**: `nextVariant` passa a ser lido fora do `try` (hoje só o `catch` vê `test` e `seqReivindicado`). No `catch`, antes de `contarFalhaDaRotacao`: se `err instanceof YouTubeApiError && err.chamada === 'blob' && err.status === 404` **e a variante da vez é `is_original`**, chama `settleOnAir(test.id, { siteId, destino: ORIGINAL, motivo: 'original_enviada_ausente', statusNote: 'pausado: a original enviada não está mais guardada', seqEsperado: seqReivindicado ?? test.restore_seq, prazo: Math.min(Date.now() + 55_000, inicioDaFuncao + PRAZO_FIM_DA_ROTA_MS) })`. `MotivoSaida` ganha `'original_enviada_ausente'`, com a mesma transição de `falha_api` (`de: ['active']`, `para: 'paused'`, `endReason: 'falha_api'` para não mexer em check de `end_reason`; o plano confirma o check). A pausa restaura com a reserva e a marca acima. Variante B/C/D com 404 segue como hoje (fora do escopo; vai ao BACKLOG que também não pausa). Rotação nunca falha calada.
- **Retomada manual (`ab-resume.ts`)**: quando `aplicado.erroApi` é blob 404 e a `proxima` é a `is_original`, devolve erro com texto específico ("A original enviada não está mais guardada. Envie de novo para retomar.") em vez do genérico, e grava `ausente_desde`. Sem queda para a reserva (a A de um experimento não troca em silêncio; o dono está na tela e decide). Outras variantes: como hoje.
- **Nova tentativa do vigia (`ab-watchdog-nova-tentativa.ts`)** passa por `tentar` → `settleOnAir`: coberta pelo primeiro item.
- A ficha (H) mostra "A original enviada não está mais guardada" com "Enviar original" (o teste está pausado).
- Quem apaga do Blob hoje: `deleteVariant` e `cleanupDraftVariants` recusam ou filtram a original (`is_original`, conferido); o `media-cleanup` só varre `media_assets`. Nenhum caminho apaga `ab-originals/`; o 404 é exceção (remoção manual no painel do Blob), mas tem de ser visível.

### 5.4 Encerrar

`encerrar-props.ts` lê `dimensions` da variante original, que agora é a da **vigente**, e aplica a regra única de D1: o selo "Baixa resolução" some quando a vigente tem 1280 ou mais (nula/0/< 1280 continua com selo). Como o envio exige 1280 sempre (passo 8 da 4.3), toda enviada aceita sai sem selo.

## 6. Tela, rascunho (F) e testes antigos (decisão 7)

### 6.1 Leitura

`queries.ts` ganha `lerOriginalDoTeste(testId): Promise<IOriginalDoTeste | null>` (chama `ab_garantir_original_publica` se `original_publica_id` é nulo) e o detalhe do teste passa a trazer o mesmo objeto. Na lista do Lab o objeto é montado **na mesma consulta** da lista (select com as duas FKs), não por teste (evita N+1):

```ts
interface IOriginalDoTeste {
  origem: 'publica' | 'enviada'
  largura: number | null; altura: number | null; bytes: number | null
  publica: { largura: number | null; altura: number | null; url: string | null }
  publicaBaixa: boolean
  enviadaEm: string | null; enviadaPorMim: boolean; nomeArquivo: string | null
  ausente: boolean
  podeTrocar: boolean      // status draft|paused|queued
  podeUsarPublica: boolean // origem enviada e !publicaBaixa e podeTrocar
}
```

### 6.2 Assistente (`ab-create-wizard.tsx`, `lib/youtube/ab-wizard-reducer.ts`)

- O rascunho nasce na escolha do tipo (`handleTypeSelect` → `createAbTest`), então o envio acontece no passo Variantes, na hora em que o arquivo é escolhido, contra `draftTestId`. `createAbTest` passa a devolver `original: IOriginalDoTeste`.
- Estado novo no reducer: `original: IOriginalDoTeste | null` e `envioOriginal: { fase: 'parado' | 'enviando' | 'caiu' | 'recusado'; progresso: number; arquivo: File | null; recusa: RecusaDaOriginal | null }`; ações `SET_ORIGINAL`, `ENVIO_ORIGINAL_INICIO`, `ENVIO_ORIGINAL_PROGRESSO`, `ENVIO_ORIGINAL_FIM`, `ENVIO_ORIGINAL_CAIU`, `ENVIO_ORIGINAL_RECUSADO`, `ENVIO_ORIGINAL_CANCELADO`. O `File` fica só na memória (não vai a `saveDraft`, que já zera `thumbFile`).
- `stepIsValid(2, state)`: para `thumbnail`/`combo`, além da regra de hoje, `!(state.original?.publicaBaixa && state.original.origem !== 'enviada')` e `envioOriginal.fase !== 'enviando'`. O resumo (G) aplica a mesma função para "Iniciar teste" (aria-disabled + motivo + "Enviar original" que leva ao passo 2 com foco na área).
- "Cancelar envio" (`xhr.abort()`) e "Tentar de novo" (reenvia o `File` guardado na memória): ao cancelar ou cair, a tela relê `lerOriginalDoTeste`; se o servidor terminou antes do abort, mostra C (a verdade é a do servidor).
- E3 do mockup ("O YouTube recusou a imagem ao guardar"): pela D10 o YouTube não é chamado no envio. E3 passa a cobrir `ilegivel` e `armazenamento` (textos de Logan, aplicados; sai "O YouTube recusou este arquivo"): ilegível, "<nome> não foi aceito. Não foi possível ler o arquivo. Tente outro arquivo."; armazenamento (503), "O envio de <nome> não foi concluído e a original não foi guardada. Tente de novo."; fecho dos dois: "Sem a original guardada, o teste não inicia." E2 com a pública baixa: "O envio de <nome> parou. A original não foi guardada, e o teste só inicia com ela. Tente de novo." (sai "o passo segue livre com a pública", que contradizia a decisão 2). O diálogo de encerrar alinha a 1280.
- F (rascunho reaberto): `existingDraftId` → `lerOriginalDoTeste` no carregamento; `origem === 'enviada'` abre em C com a faixa verde.

### 6.3 Ficha do teste (H, `[testId]`)

Linha "Original guardada" com origem, data e resolução. `publicaBaixa && origem === 'publica'`: `active` → "Pause o teste para enviar a original em alta."; `paused` → aviso + "Enviar original" + Retomar livre (decisão 7: `retomarTeste` não ganha guarda nova). `ausente` → texto da seção 5.3. Pública que mudou no YouTube depois do envio (desfazer do passo 2 do início): "A thumbnail do vídeo mudou no YouTube depois do envio da original. Confira a thumbnail atual e envie a original de novo."

### 6.4 Rascunhos antigos

Rascunho criado antes do deploy com pública baixa: o início é novo, logo exige o envio (D2). Rascunho sem `original_publica_id` só existe na janela entre `db:push:prod` e o deploy: `lerOriginalDoTeste` e a guarda do início o corrigem na hora com `ab_garantir_original_publica`, e o plano reaplica a conferência depois do deploy (seção 3 passo 7).

## 7. Cowork e MCP em paridade

- Sem rota nova no pipeline: o pipeline não sobe imagem hoje (o `POST .../ab-tests/:id/variants` só grava texto e metadados), e o envio da original fica no CMS. `api-registry.ts` não muda.
- Leitura em paridade: `lib/pipeline/services/youtube.ts` (lista fechada `CAMPOS_DO_TESTE_QUE_SAEM_COMO_VIERAM`) ganha um objeto derivado `original: { origem, largura, altura, publica_largura, publica_baixa, enviada_em, ausente }` em `GET /api/pipeline/youtube/ab-tests` e `GET .../ab-tests/{id}` (MCP `manage_ab_test` `list_tests`/`get_test`, mesmo serviço). Sem `enviado_por`, sem URL do Blob da enviada.
- Docs: seção "GET /ab-tests/:id e list_tests" de `apps/web/data/pipeline-docs/cowork-docs-youtube.md`; `docs/cowork-pipeline-reference.md` se o esquema da seção mudar; rodar o script de semente (memória `reference_cowork_pipeline_schemas`).
- Cowork e Claude Code leem o mesmo número; nenhum deles inicia teste com pública baixa sem envio porque a guarda está no servidor.

## 8. Critérios de aceite

1. `ab_test_originais` existe com RLS ligada; um usuário sem `can_edit_site` não lê nenhuma linha, inclusive com `app.site_id` falsificado como não-superusuário.
2. Depois do backfill, todo teste `thumbnail`/`combo` tem `original_publica_id = original_vigente_id` apontando para uma linha `publica` com os mesmos `blob_url`, `dhash` e dimensões da variante original.
3. `POST` com JPEG 1920×1080 de 1,2 MB num rascunho com pública 480×360 devolve 200; a variante original passa a ter `blob_url` da enviada, `dimensions = '1920x1080'`; `ab_tests.original_thumbnail_url` igual; a linha `enviada` tem `sha256_*`, `bytes_*`, `largura_publica = 480`, `enviado_por`.
4. O arquivo guardado não tem EXIF (teste com JPEG que carrega GPS e `Orientation = 6`: saída sem `exif`, dimensões orientadas). JPEG 1920×1080 q98 sem EXIF sai com `sha256_guardado = sha256_recebido` (sem recompressão); JPEG sujo sai q95 com `chromaSubsampling === '4:4:4'`; JPEG CMYK sai `space === 'srgb'`.
5. Recusas, cada uma com linha `recusado` e o `motivo_recusa` certo (exceto corpo > 4,5 MB, recusado pela plataforma antes do código, sem linha e mapeado a `tamanho` na tela; corpo entre 2 MB e 4,5 MB tem linha com `bytes_recebidos` do cabeçalho): WEBP (`formato`), 3,4 MB (`tamanho`), 1200×900 (`proporcao`), 1000×563 com pública baixa **ou** com pública 1280 (`pequeno`, mínimo 1280 sempre), imagem diferente da pública (`diferente_da_publica`, **RECOMENDADO, aguarda o dono**), bytes inválidos com `Content-Type: image/png` (`ilegivel`).
6. GIF 1280×720 é aceito e guardado como PNG de um quadro.
7. Reenvio do mesmo arquivo não cria linha nem blob novo.
8. `POST` em teste `active` ou `completed` → 409, nada gravado no Blob; em `queued` → 200. Usuário de outro site → 404. Reporter → 403. `sec-fetch-site: same-site` → 403, sem `requireSiteScope` nem Blob. `Content-Length: 3000000` → 413 JSON, `formData` não chamado, linha `recusado`. PNG 20000×20000 → `ilegivel` sem estourar memória.
9. `DELETE` com pública baixa → 409; com pública 1280×720 e enviada vigente → volta à pública e `podeUsarPublica` vira falso.
10. `startAbTestInternal` com pública baixa e sem enviada devolve `codigo: 'original_baixa'` e não muda status; com a enviada, inicia; playoff filho de pai com pública baixa inicia.
10b. Início de rascunho de pública 480×360 com `maxresdefault` agora no ar (sonda com dHash diferente): a guarda não recusa e o início chega a `active` com a nova pública. Pública guardada baixa e sonda igual → `original_baixa`, status intocado. Fila com teste de pública baixa → sai para `draft` na 1ª passada, um aviso, `queue_start_after` continua nulo; 2ª passada não avisa de novo.
10c. Início com thumbnail trocada no YouTube e vigente `publica`: `ab_registrar_original` chamado com o `seq` reivindicado, teste chega a `active`; função com `seq` errado → `'status'`, sem `seq` → `'status'`.
11. Início com a enviada e thumbnail no ar diferente da pública guardada → desfaz para rascunho com a mensagem da 5.2 e não regrava a original.
12. Início com a enviada respondendo 404 → recusa e grava `ausente_desde`.
13. Pausa e encerramento de teste com enviada escrevem no YouTube os bytes da enviada (mock de `setThumbnail` recebe o buffer do blob enviado).
14b. Rotação com a vez da A e a enviada 404 → `settleOnAir` chamado uma vez com `motivo: 'original_enviada_ausente'`, teste `paused`, `restore_status.thumbnail.motivo = 'original_enviada_ausente'`, pública no ar, um aviso; 404 numa variante B → não chama. Retomada manual com a enviada 404 → erro específico e `ausente_desde`. Nova tentativa do vigia com a enviada 404 → usa a reserva. Cada caminho tem teste próprio (`ab-rotate-phases.test.ts`, `ab-resume.test.ts`, `ab-watchdog-nova-tentativa.test.ts`, `ab-settle.test.ts`).
14. Settle com a enviada 404 e reserva pública → escreve a reserva, `restore_status.thumbnail.motivo = 'original_enviada_ausente'`, alerta emitido; sem reserva → `falhou`.
15. O envio não faz chamada a `googleapis.com` (fetch espionado).
16. Assistente: estados A–H do mockup reproduzidos (1440 e 390, claro e escuro); Próximo e Iniciar com `aria-disabled` e motivo nos casos B/E/G; F abre em C.
17. Pipeline: `GET /api/pipeline/youtube/ab-tests/{id}` e `get_test` do MCP trazem o mesmo objeto `original`, sem `enviado_por`.
18. Diálogo de encerrar sem selo "Baixa resolução" quando a vigente tem 1280 ou mais; com selo para `dimensions` nulo, 0 ou < 1280.
19. Integração: `ab_garantir_original_publica` em teste sem linhas cria uma e aponta os dois ids; segunda chamada não cria outra. Playoff de pai com enviada → filho com linhas próprias (`copiada_de`); `DELETE` no filho (pública alta) → `'ok'`; `delete` do pai mantém os ids do filho. Falha do insert no envio (porta de banco que lança) → `del` chamado com a URL do `put`.
19b. Integração: `ab_garantir_original_publica` com duas conexões ao mesmo tempo → uma linha só; `ab_registrar_original` com `test_id`/`site_id` de outro teste no JSON usa os de `p_test_id`; enviar, `DELETE`, ler: `substituida_em` da pública nulo e da enviada preenchido; playoff de pai legado (sem `original_publica_id`) → filho com as linhas e o `thumbnail_dhash` na variante original.
20. Backfill nas 3 originais de produção: 2 com `largura`/`altura` nulas e `registro = 'backfill'`, 1 com 480×360 e `copia_publica = 'hqdefault'`.

## 9. Roteiro de prova

- **Unit (Vitest, `// @vitest-environment node`):** `ab-original-resolucao.test.ts` (limites 1279/1280, tolerância 16:9, `dimensions` nulo); `ab-original-envio.test.ts` com imagens geradas por sharp na hora (critérios 4–7, 15; CMYK); `ab-start.test.ts` (10–12); `ab-settle.test.ts` (13–14); reducer (`stepIsValid`, transições de envio).
- **Integração no `bythiago_int` (54421/54422, `HAS_LOCAL_DB=1`):** migration aplicada do zero e reaplicada (idempotência); backfill (2); RLS com GUC falsificado (1); `ab_aplicar_original` com `active` e `restore_seq = 5`: `p_restore_seq = 5` → `'ok'`, `4` → `'status'`, nulo → `'status'`; `queued` aceita; corrida com `update status` em outra conexão; `ab_registrar_original` sem linha `aceito` órfã na recusa; `create_playoff_test` copiando as linhas.
- **Rota:** `route.test.ts` com `requireSiteScope` simulado (8, 9).
- **Ponta a ponta (Gio):** Playwright no CMS autenticado local, vídeo de semente com pública 480×360 e outro com 1280×720; percorre A–H e compara as capturas com `docs/superpowers/mockups/2026-10-19-ab-original-em-alta/shots/r4-*.png`; mede `scrollWidth` a 390; Tab até a área de envio. Capturas em arquivo, veredito em texto.
- **Real, antes da promoção:** um arquivo-mestre real do dono num vídeo do canal: distância dHash enviada × pública ≤ 6 (o proxy do Phil, 0 a 4 em 6 vídeos, vem da própria maxres; `sddefault` veio 640×480 nos 6, confirmando D1).

## 10. Riscos, custos e fora do escopo

Riscos:
- Limiar de D13 calibrado em hqdefault × hqdefault e em proxies (0 a 4); o arquivo real do dono pode passar de 6 e recusar o arquivo certo. Mitigação: a coleta grava `dhash_distancia_publica` também nas recusas; o roteiro real mede antes.
- Corrida troca × restauração em curso num teste pausado: escreve a A antiga uma vez; aceita (a próxima volta corrige). Dívida abaixo.
- Blob público: a URL da enviada é pública como as das variantes (mesmo modelo de hoje); não é listada em lugar nenhum fora do CMS.
- A original nova não vai ao ar ao ser enviada num teste pausado (D10): até a próxima volta da A, o vídeo segue com a cópia baixa. O texto de C/H não promete o contrário.
- Blob órfão se o processo morrer entre o `put` e o `catch` (2 MB, raro).
- PNG de paleta recodificado cresce (Phil mediu 533 KB para 890 KB, 1,67×): um PNG de 1,3 a 2 MB pode virar `tamanho` falso. Dívida declarada; gatilho: primeiro caso real, e então guardar os bytes recebidos quando `meta.isPalette` e couberem.
- Comentário COM de JPEG não é exposto por `metadata()` e passa num JPEG limpo.

Custos (medidos por Phil em 19/10):
- Armazenamento: ≤ 2 MB por envio aceito, típico 0,5 a 1,5 MB. Produção: 3 testes no total, 2 nos últimos 30 dias; 2 testes/mês × 1,5 envio × 1,2 MB ≈ 43 MB/ano (pior caso 10 testes/mês × 3 × 2 MB = 720 MB/ano). Linhas: ≈ 60/ano, < 100 KB/ano. Blobs substituídos não são apagados nesta fase.
- Cota do YouTube: zero no envio. `thumbnails.set` = 50 unidades (`lib/youtube/portao-dhash/youtube.ts:1`), já existente a cada pausa, rotação e encerramento; de 10.000/dia, o número não muda, só o arquivo.
- CPU: um `sharp` de até 2 MB por envio (≈ 100 a 300 ms, estimativa não medida; o mozjpeg q95 4:4:4 de 8 a 40 Mpx pode levar segundos: medir com um JPEG sujo de 12 Mpx e fixar `maxDuration`), teto de 40 Mpx.

Dívida técnica:
| Dívida | Gatilho para pagar |
|---|---|
| `uploadVariant` (B/C/D) sem EXIF strip e confiando em `file.type` (LGPD) | lote próprio; `validarArquivoDaOriginal` reusável |
| Blobs substituídos e `ab-originals/` de testes removidos com o canal não apagados | > 1 GB em `ab-originals/` ou limpeza do Blob (BACKLOG: a remoção de canal deve listar e apagar) |
| Corrida troca × retomada/settle sem `restore_seq` na função | primeiro caso real ou próxima mexida em `ab-resume.ts` (padrão do P4: somar 1 em `restore_seq` com teste de integração do vigia) |
| 404 do Blob em variante B/C/D também não pausa a rotação | BACKLOG |

Fora do escopo:
- EXIF e validação real de dimensões no `uploadVariant` das variantes B/C/D (hoje confia em `file.type` e não tira EXIF): lacuna de LGPD registrada para lote próprio; a função `validarArquivoDaOriginal` foi desenhada para ser reusada lá.
- Envio da original pelo Cowork/MCP.
- Aplicar a original no ar na hora do envio.
- Limpeza de blobs substituídos.
- Itens 2 a 5 de `melhorias-pos-ensaio-t19.md`.

## 11. Decisões da r3 e da r2

### Decisões da r2

Achados de Yannis (Y: B1 B2 C1-C9 S1-S3) e Phil (P: B1 B2 C1-C8 S1 S2). Onde divergiram:

- **Assinatura da função (Y-B1 × P-B2/C4).** Os dois pedem `p_restore_seq` para aceitar `active` no início. Phil acrescenta uma função única que registra e aplica (C4). Escolhido: as duas, em camadas: `ab_registrar_original` (insere + aplica numa transação, é o que o app chama) sobre `ab_aplicar_original` (usada sozinha pelo `DELETE`). Porque o `DELETE` só aplica, e porque a linha `aceito` que nunca valeu é o defeito que Phil provou. `p_restore_seq` como `integer` (a coluna é `integer`, não `bigint`).
- **`queued` (Y-C1 × P-B2b).** Yannis: não ampliar D4 para `queued`, só tirar da fila. Phil: incluir `queued`. Escolhido Phil + saída imediata da fila de Yannis, porque o brief pede teste em `queued` aceitando envio e a fila não insistindo 7 dias; as duas medidas juntas fecham as duas pontas.
- **Recompressão do JPEG (Y-C4 × P-C2).** Yannis: sempre q95 4:4:4 mozjpeg. Phil: passa os bytes se limpo. Escolhido Phil para JPEG limpo (zero perda, `sha256_guardado = sha256_recebido`), Yannis para JPEG sujo (q95 4:4:4 mozjpeg, q90 só se passar de 2 MB). PNG sempre `compressionLevel 9` (sem perda). Dimensões do `info` da saída (Y).
- **Limite de 4,5 MB (Y-C3 × P-C7).** Os dois: checagem na tela; Yannis acrescenta `Content-Length` na rota e `limitInputPixels`. Escolhido a soma. Client upload com token recusado: o teto é 2 MB, então só recusa passa de 4,5 MB, e o token tiraria a validação do servidor antes do armazenamento.
- **Playoff (Y-C6 × P-C3).** Os dois: copiar as linhas para o filho. Phil acrescenta `copiada_de`; Yannis, o `raise` quando a atualização da variante original toca zero linhas. Escolhido ambos; filho sem variante original só atualiza `ab_tests.original_thumbnail_url`.
- **Rotação com 404 (Y-B2 = P-B1).** Coincidem. Detalhe: `MotivoSaida` ganha `'original_enviada_ausente'` com a transição de `falha_api`; Phil pede também testar `ab-resume` e nova tentativa, que Yannis não rastreou; incluídos em 5.3 (retomada com erro específico, sem queda para a reserva) e nos critérios.
- **Backfill e deploy (Y-C5 × P-C6).** `ab_garantir_original_publica` (Y) é a mesma regra do backfill com a marca `registro = 'backfill'`, `status_do_teste = 'draft'` e `copia_publica` inferida (P). Conferências do dia do push (P) incluídas.
- **Mínimo `max(640, largura_publica)` (P-C1 ii).** Superado na r3 pelo ruling do controlador (1280 sempre). Alinhamento do diálogo de encerrar (P-C1 i): regra única < 1280 na vigente, aplicada.
- **Y-C7** (sonda antes de recusar): 5.2. **Y-C8** (órfão): 4.3 passo 12. **Y-C2** (origem) e **Y-C9/reporter/auditoria**: 4.2. **P-C5** (largura 0): seção 2 e `publicaBaixa`. **P-C8** (aviso com fim definido): 5.3. **Y/P S1** (índice fora, `revoke` de `authenticated`): seção 2 e 3. **Y-S1** (restore_seq na função) e **Y-S2** (idempotência fora da trava): declarados (3, 4.3 passo 9, dívida). **Y-S3** (texto de E2): PENDENTE DONO/Logan.
- **Pendências da r2 (resolvidas na r3):** textos de E3, E2 e "mudou no YouTube" (Logan); mínimo (ruling 1280); o 5º caso de D segue recomendado, aguardando o dono.

### Decisões da r3

Achados de Yannis (R2-1 a R2-5 e menores a, b) e Phil (1 a 4 e menores 1 a 5) sobre fcfc3e32e:

- **Mínimo 1280 sempre (Y R2-1 = P 1).** Ruling do controlador. Removidos `LARGURA_MINIMA_COM_PUBLICA_ALTA`, `larguraMinimaDoEnvio` e a pendência do passo 6; D3, 4.1, 4.3 passo 8, 5.4, critério 5 (1000×563 vira `pequeno` com pública baixa ou alta), testes unitários (sem os limites do mínimo menor) e este bloco.
- **Ordem única da 4.3 (Y R2-4 = P 3; P 2).** Teste lido (1), status (2), `Content-Length` (3, depois do status: um 409 ganha de um 413), `formData`/tamanho (4), `metadata` (5), processamento (6), proporção (7), mínimo (8), dHash (9), idempotência (10), `put` (11), `try/catch` do registro (12), revalidate e auditoria (13). Processar vem antes de medir proporção e mínimo porque as dimensões orientadas saem do `info` da saída.
- **Trava em `ab_garantir_original_publica` (Y R2-2).** `for update` no teste e releitura; critério 19b.
- **`ab_registrar_original` não confia no JSON (Y R2-3).** `site_id`/`test_id` de `p_test_id`, `origem` validada, `id`/`substituida_em`/`ausente_desde` ignorados; `nao_pertence` grava `status_do_teste`.
- **JPEG limpo (Y R2-5).** `space` fora de `srgb`/`b-w` (CMYK) e `comments` contam como sujo (sRGB na saída). Medido com sharp 0.35.5: `space` vem em `metadata()` (CMYK devolve `cmyk`); o COM de JPEG não aparece lá, declarado.
- **`substituida_em = null` na nova vigente (P 4).** Critério 19b.
- **Menores:** playoff chama `ab_garantir` do pai antes da cópia e copia `thumbnail_dhash` (Y a, P 5); `maxDuration` depois de medir 12 Mpx (Y b); PNG de paleta como dívida (P 1); sonda sem `dhash` → "Tente de novo" (P 2); `queue_start_after` continua nulo (P 3); `Content-Length` do critério 8 em 3_000_000 (P 4).
- **Textos de Logan aplicados:** E3 (ilegível, armazenamento, fecho), E2 com a pública baixa, "mudou no YouTube" (5.2 e ficha H). O 5º caso de D (dHash > 6 → recusar) entra em D13 e na 4.3 passo 9 com a marca **RECOMENDADO, aguarda o dono**; antes da promoção, medir com o arquivo-mestre real do dono.
