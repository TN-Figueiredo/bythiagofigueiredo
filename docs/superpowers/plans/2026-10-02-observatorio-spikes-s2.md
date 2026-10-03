# Observatório v2 — Spike S2 (custo e tempo da sincronização por canal)

Medido em 2026-10-03 com a YouTube Data API real, rodando o `syncCompetitorChannel` ATUAL contra um banco LOCAL (produção só lida: `select channel_id, video_limit`). Produção tem 15 canais, todos com `video_limit = 50`; nenhum com 200. Para cobrir o caso grande, 5 ids reais de produção foram semeados localmente, 2 deles com `video_limit = 200` (UCNMMFx2…, UC2ojq-n…) e 3 com 50. Probe: `fetch` embrulhado, contando chamadas por endpoint (channels/playlistItems/videos = 1 unidade, search = 100). Duas passagens por canal: `first` (banco vazio, backfill) e `incremental`.

## Medições brutas (10 execuções)

| canal | limit | passe | unidades | chamadas | segundos |
|---|---|---|---|---|---|
| UCNMMFx2 | 200 | first | 9 | 1 ch + 4 pl + 4 vid | 3,0 |
| UCNMMFx2 | 200 | incremental | 3 | 1+1+1 | 0,7 |
| UC2ojq-n | 200 | first | 9 | 1+4+4 | 2,8 |
| UC2ojq-n | 200 | incremental | 3 | 1+1+1 | 0,8 |
| UCYemYgs | 50 | first | 3 | 1+1+1 | 0,8 |
| UCYemYgs | 50 | incremental | 3 | 1+1+1 | 0,8 |
| UC4aBuTS | 50 | first | 3 | 1+1+1 | 0,9 |
| UC4aBuTS | 50 | incremental | 3 | 1+1+1 | 0,8 |
| UCWm__g4 | 50 | first | 3 | 1+1+1 | 0,8 |
| UCWm__g4 | 50 | incremental | 3 | 1+1+1 | 0,8 |

Achado: o incremental ATUAL de um canal com limit 200 custa só 3 unidades porque para na primeira página ao encontrar um vídeo conhecido (`hitKnownVideo`). Ele re-checa apenas os 50 mais novos. O desenho novo (re-checar todos os vídeos rastreados com menos de 90 dias a cada 6 h, e todos uma vez por dia) é mais caro, então a tabela abaixo separa os dois.

## S2 — Data API cost and time (5 channels, local DB)

| passe | unidades mediana | unidades p90 | segundos p90 |
|---|---|---|---|
| first (backfill) | 3 (limit 50) / 9 (limit 200) → mediana geral 3 | 9 | 3,0 |
| incremental 6 h, comportamento atual (para no 1º vídeo conhecido) | 3 | 3 | 0,9 |
| incremental 6 h, desenho novo (re-checa TODOS os rastreados; `1 + 2·ceil(limit/50)`) | 3 (limit 50) / 9 (limit 200) | 9 | 3,0 (proxy: tempo medido do first com 200) |
| daily 12:00 record (+), só `videos.list` = `ceil(tracked/50)` | 1 (limit 50) / 4 (limit 200) | 4 | ~2,2 (4 chamadas `videos.list`, ~0,55 s cada) |

Notas de método: `UNITS_PER_CHANNEL_6H` do desenho novo = `channels(1) + playlistItems(ceil(limit/50), para descobrir vídeos novos; pode cair para 1 página no incremental) + videos(ceil(limit/50))`. O limite superior usado aqui conta a playlist inteira (pior caso). O registro diário não precisa de `channels` nem `playlistItems`: os ids vêm do banco. Os segundos do "desenho novo" e do registro diário são extrapolados do tempo medido (~0,7–0,8 s por par playlist+videos, ~3 s para 4 páginas); não foram medidos diretamente.

## Valores de decisão

- `UNITS_PER_CHANNEL_6H` = mediana **3**, p90 **9** (50 → 3, 200 → 9; mix real de produção, todos em 50, é 3).
- `UNITS_DAILY_RECORD` = **1** (limit 50) / **4** (limit 200) por canal, extra.
- `SECONDS_PER_CHANNEL` p90 = **3,0 s**.
- `BATCH_SIZE` = floor(200 / 3,0) = 66, limitado a **15**.
- Cadência do cron: `*/20 * * * *` (3 execuções/h × 6 h = 18 execuções por janela ≥ ceil(75 / 15) = 5; folga de 3,6×).
- Detecção de mudança em toda sincronização só para vídeos com menos de 90 dias; mais antigos checados uma vez por dia (spec §7).

## Unidades por dia para 75 canais (cota 10 000)

Fórmula: `75 × (4 × U6h + Udiário)`.

| cenário | U6h | Udiário | unidades/dia |
|---|---|---|---|
| produção hoje (todos limit 50) | 3 | 1 | 75 × 13 = **975** |
| todos limit 200, re-checando todos a cada 6 h | 9 | 4 | 75 × 40 = **3 000** |
| comportamento atual (3 un. por passe) + registro diário limit 200 | 3 | 4 | 75 × 16 = 1 200 |

Pior caso 3 000 un./dia < 6 000: **o limiar não foi excedido**, então o registro diário em 1×/dia cobre todos os vídeos rastreados sem restrição adicional. Backfill inicial (one-off): 9 un. por canal com limit 200, ~675 un. para 75 canais, fora do orçamento diário.

## Decisão

BATCH_SIZE = 15 · cron `*/20 * * * *` · detecção de mudança em toda sincronização apenas para vídeos < 90 d; mais antigos 1×/dia.
