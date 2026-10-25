# Archive Domain — Monthly Archive Routes (NAS / B2 workers)

> **Not for Cowork.** These routes are machine-to-machine. They accept only `archive_*` API keys held by the home workers
> (the copier, the B2 checker, the responder) and by the owner's Mac command. No MCP tool wraps them, on purpose: an exporter of
> third-party text must not be reachable from Cowork. `admin` and `write` keys do not open them; a CMS session gets `403 API key required`.

Base: `/api/pipeline/archive/`. Nine routes. Auth header: `X-Pipeline-Key`.

## Common rules

| Rule | Detail |
|---|---|
| Permission | Exact, per route: `archive_copy` (copier), `archive_b2` (B2 checker), `archive_read` (responder), `archive_owner` (owner's Mac, only `pending` and `pode-desligar`) |
| Wrong permission | `403 FORBIDDEN "Insufficient permissions"` |
| Archive-only key elsewhere | A key whose permissions are all `archive_*` gets `403 "Forbidden"` on any pipeline route outside `/api/pipeline/archive/` |
| Order of refusals | key (401/403/429) → permission (403) → `OBS_ARQUIVO` (503) → body by Zod (400) → pair (class, table) outside the policy (422) → route rule |
| `OBS_ARQUIVO` | Only the value `on` turns the archive on. Anything else: `503 arquivo_desligado` on every route, never an empty list |
| Rate limit | 100 requests/min per key. `429` carries `X-RateLimit-Reset`; decide by the status, never by the `code` |
| Envelope | Success `{ "data": ... }`. Error `{ "error": { "code", "message", "details"? } }`. The worker decides by `code` |
| General errors | `400 VALIDATION_ERROR`, `500 erro_do_banco` (the cause goes to Sentry, never to the caller), `504 tempo_esgotado` (database `57014`) |
| Expected values | No response returns an expected hash, row count or sum. The site compares; the worker only reports what it read |

## GET /archive/plan (archive_copy)

What is due now. Query: `completo=1` (ask for a full sweep), `cursor=<text>` (next page of `reconferir`, any mode, up to 200 chars).
Side effect: records the copier's last poll. Response `data`: `plano_id`, `gerado_em`, `modo` (`normal` | `completo`), `cursor_seguinte`,
`primeira_selagem` (`AAAA-MM` or null: "waiting for the first sealing"), `vermelhos` (never absent), `canario.dia`, `exportar`
(items with `motivo`: `nova`, `conteudo_mudou`, `arquivo_ausente`, `divergente`, `conteudo_divergente`, `mudou_durante_a_leitura`, `parte_mudou`),
`resumos`, `manifestos`, `aguardando_dono` ("waiting for the owner's file": items the owner must restore), `a_apagar`, `reconferir` (up to 1,000 per page).
A unit the site gave up on is lost: `lost_reason` is `ausente_nas_e_b2` or `nunca_recebida`. `ainda_nao_conferido` is the answer of the
`declarar-perdida` command (M8/M9), cited here for whoever reads the plan.

## GET /archive/plan?fonte=b2 (archive_b2)

What the B2 checker must verify. Extra fields: `execucao_id` (valid 2 h from the last page asked), `estado` per child (`aguardando_primeira_selagem`,
`nada_devido`, `com_pedidos`), `teto_bytes_dia`, `teto_bytes_mes`, `controle_negativo`, `canarios` (both children), `arquivos` (up to 500 per page),
`retomado_de` and `cobertura` (a full sweep that did not finish is resumed by the site). `nada_devido` is green only with the canary accepted in the same execution.

## POST /archive/unit/export (archive_copy)

Body `{ classe, tabela, canal, mes, parte? }` (`parte` 1..99, only after the first answer says there are parts). Pair outside the policy: `422 classe_tabela_invalida`.
Answers the bytes of a `.csv.gz` (`application/gzip`) and the values in headers: `X-Arquivo-Id` (`u:<uuid>` or `p:<uuid>:NN`), `X-Arquivo-Versao`,
`X-Arquivo-Caminho`, `X-Arquivo-Linhas` (of the file returned, so of the part), `X-Arquivo-Soma` (empty when null and **empty in every part**), `X-Arquivo-Sha256`,
`X-Arquivo-Csv-Sha256`, `X-Arquivo-Bytes`, `X-Arquivo-Partes`, `X-Arquivo-Parte`, `X-Arquivo-Coluna-Controle`.
A unit with zero rows answers JSON `{ arquivo_id, versao, vazia: true, linhas: 0 }`: nothing to write, the unit is already final.
A unit above 60,000 rows answers `413 grande_demais` before reading any page. A part is never truncated: a unit over 3 MB is split (at most 99 parts).

| Status | code | Meaning for the worker |
|---|---|---|
| 409 | `canal_removido` | channel gone or removal registered: skip the unit, never an execution error |
| 409 | `unidade_retirada` | the (class, table, month, channel) already has a version with `dropped_at`: skip, red |
| 409 | `mes_fora_do_banco` | the month was detached or dropped: never re-exported from the online data: skip, red |
| 409 | `mes_aberto` | the month has not reached its due day: the plan never asks for it, so it is a site divergence: red |
| 409 | `nao_devida` | the unit is not due, or the part/version was already received: red |
| 409 | `mudou_durante_a_leitura` | the data changed in 3 consecutive reads: skip; the plan returns it again |
| 409 | `parte_mudou` | the part re-read does not match the registered one: drop the parts already downloaded |
| 409 | `tabela_ausente` | a table of the policy does not exist in the database: red, the month does not seal |
| 413 | `grande_demais` | over 99 parts or over the row ceiling: skip, red |
| 422 | `classe_tabela_invalida` | (class, table) outside the policy: `plano_invalido`, red |
| 422 | `faixa_invalida` | read range outside the limits (a site defect): skip, red |

## POST /archive/month/summary (archive_copy)

Body `{ classe, canal, mes }`. Answers only when **every expected table** of the channel has a final unit (received, empty confirmed or lost); zero units is pending, never final.
It recomputes each unit's content hash first. `200`: `{ arquivo_base: "s:<uuid>", versao, vazio, arquivos: [{ arquivo_id, tipo: "resumo", papel: "canal"|"video"|"ficha", caminho, sha256, bytes, linhas, conteudo_base64 }] }`.
`vazio: true` means every table is empty: the summary is final without a file.
Errors: `409 unidades_pendentes` (`details`: the pending ids and `faltando:<tabela>`), `409 conteudo_mudou` (a hash changed; the unit is due again), `409 canal_removido`,
`409 ja_no_arquivo` (the month is already detached or dropped), `409 resumo_da_m10b` (class `video_antigo`), `413 grande_demais`.

## POST /archive/month/manifest (archive_copy)

Body `{ classe, mes }`. Answers once every expected (table, channel) has a final unit and every expected channel has its summary received or empty.
`200`: `{ versao, arquivos: [json, sha256] }`, each `{ arquivo_id: "m:<classe>:<mes>:v<N>:json|sha256", tipo: "manifesto", caminho, sha256, bytes, conteudo_base64 }`.
Errors: `409 unidades_pendentes` (`details`: `faltando:<tabela>:<canal>`), `409 resumos_pendentes` (`details`: the channels without a received summary).

## POST /archive/unit/received (archive_copy)

What was re-read from the NAS after the `mv`. Body `{ itens: [{ arquivo_id, sha256, bytes, linhas|null, soma|null }] }`, 1..100 items; in a part, `linhas` and `soma` are the part's.
`200`: `{ itens: [{ arquivo_id, resultado }], selados: [{ classe, mes, versao }] }`. `resultado`: `recebida` and `ja_recebida` are good; `divergente`,
`conteudo_divergente` (same sha256, different count or sum), `canal_removido` (nothing is written), `desconhecido`.
`selados` lists the months this report sealed; a month seals once.

## POST /archive/attest (archive_copy for fonte nas; archive_b2 for fonte b2)

- `fonte: "nas"`: `{ plano_id, filhos, canarios, itens: [{ arquivo_id, resultado: presente|ausente|nas_fora|ilegivel, ... }] }`, up to 500 items. Every copier execution sends at least one attest with both canaries of the day.
  `ausente` only with the folder mounted and the sentinel present. `ilegivel` goes without values and counts as `divergente`. Answer: per item `aceito`/`recusado` (`desconhecido`, `filho_fora`, `forma`) and per canary (`sha256_diferente_no_dia`, `dia_invalido`).
- `fonte: "b2"`: `{ execucao_id, itens: [{ arquivo_id, resultado: presente|ausente|sem_acesso|chave_ausente|nao_decifra, file_id?, upload_timestamp?, tentativa }] }`, 1..200 items. Answer: the execution state (`aguardando_controle`, `controle_ok`, `controle_falhou`) and per item `aceito`/`repetir`/`recusado`.
- `prefixo_ausente` and `prefixo_presente` belong to M9: today they are `400 VALIDATION_ERROR`. The permission of the other source gets `403`.
- The answer never carries the expected hash, count or sum.

## POST /archive/heartbeat (archive_copy | archive_b2 | archive_read)

The worker is **derived from the key's permission**, never from the body (a `worker` field is a `400`, the body is strict). Body: `versao`, `hora_maquina`, `nas_ok`, `montagens_ok`, `sentinela_ok`,
`livre_bytes`, `total_bytes` (required), `parado_no_teto` (`dia`|`mes`|null), `ultimo_erro` (up to 200 chars). Answer `{ gravado, teto }`: `gravado: false` means fewer than 30 s since the last one (not an error);
`teto` (`verde`|`ambar`|`vermelho`) is non-null only for the B2 checker and is counted by the site.

## GET /archive/pode-desligar (archive_owner only)

Read by the owner's Mac before switching the NAS off. No body, no query (any parameter is `400`). Answer `{ pode: boolean, faltam: [{ motivo, classe, tabela, mes, detalhe }] }` with
`motivo` in `automatico_armado`, `mes_nao_recebido`, `b2_vencido_mes_fora`. `pode` is true only with `faltam` empty. An answer outside this shape is `500 erro_do_banco`, **never** `200` with `pode: true`.
Headers: `X-RateLimit-*` and `Cache-Control: no-store`. The Mac reads anything but a well-formed `200` as "could not read" and says do not switch off.

## GET /archive/pending (archive_owner only)

The owner's pending archive steps, read by the Mac command (`obs:arquivo`). No body, no query. Answer: `{ versao: 1, lido_em, total, itens: [...] }`.
**Zero measured is `200` with `total: 0` and `itens: []`; never `data` empty, null or without `lido_em`.** A body outside the shape is `500 erro_do_banco` and goes to Sentry, never `200`.
In M3b `apagar` and `b2_nomes` are always empty. The site is the key's own (`pipeline_api_keys.site_id`). Headers: `X-RateLimit-*` and `Cache-Control: no-store`.

## Status codes added by this domain

`arquivo_desligado` 503, `erro_do_banco` 500, `tempo_esgotado` 504, `canal_removido` 409, `sem_destino` 409, `unidade_retirada` 409, `mes_aberto` 409, `nao_devida` 409,
`mes_fora_do_banco` 409, `mudou_durante_a_leitura` 409, `parte_mudou` 409, `unidades_pendentes` 409, `conteudo_mudou` 409, `resumos_pendentes` 409, `ja_no_arquivo` 409,
`resumo_da_m10b` 409, `tabela_ausente` 409, `grande_demais` 413, `classe_tabela_invalida` 422, `faixa_invalida` 422.
A destination of the archive that was not declared (`destino_do_arquivo_nao_declarado`) and a repeated request (`ja_pedido`) come from the removal functions (`02` §10.6), not from these routes.

## What the worker never does

- Never sends a hash, count or sum as an "expected" value: it sends what it read, and the site decides.
- Never builds a path from anything but the validated components; a path in the plan that differs from the one it built is `plano_invalido`.
- Never treats `503 arquivo_desligado` as success: it is a red outcome.
- Never uses `PIPELINE_COWORK_KEY`: it has no `archive_*` permission.
