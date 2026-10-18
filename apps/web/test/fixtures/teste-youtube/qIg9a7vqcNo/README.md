# Fixture qIg9a7vqcNo (teste nativo do YouTube) — NÃO EDITAR

Recorte do experimento de 18/10/2026 (vídeo `qIg9a7vqcNo`), até `em <= 2026-10-18T17:23:00Z`: 60 leituras da watch em 20 rodadas de 3, mais as sondas de miniatura no mesmo corte.

Origem: `~/portao-dhash/nativo-qIg9a7vqcNo/` (scripts `sondar.sh` e `sondar-paginas.sh`). A fonte só anexa; a sonda horária continua escrevendo lá.

## Como foi gerado

```bash
SRC=$HOME/portao-dhash/nativo-qIg9a7vqcNo
DST=apps/web/test/fixtures/teste-youtube/qIg9a7vqcNo; C=2026-10-18T17:23:00Z
mkdir -p $DST
awk -F'\t' -v c=$C 'NR==1 || $1<=c' $SRC/titulos.tsv > $DST/titulos.tsv          # 121 linhas
awk -F'\t' -v c=$C 'NR==1 || $1<=c' $SRC/sondas.tsv  > $DST/sondas.tsv           # 537 linhas
awk -F'\t' -v c=$C 'NR==1 || ($1<=c && $2=="teste" && $3=="watch")' $SRC/paginas.tsv \
  | sed "s/');\$//" > $DST/paginas-watch.tsv                                      # 361 linhas
```

`dhash.tsv` (35 linhas de dados) foi derivado uma vez por um script descartável (rodado de `apps/web` com `npx tsx`): para cada imagem de `img/` (15), `img-pag/` (14) e `para-o-studio/` (2), `dhashOf` de `src/lib/youtube/thumb-fingerprint.ts` e `sharp(bytes).metadata()` para largura e altura; mais 4 linhas `origem sqp-completa-18/10` copiadas da tabela §2.3 do spec (imagens não guardadas). Colunas: `arquivo sha16 variante largura altura url dhash origem` (`-` = nulo). As 5 linhas de `img/` com sha `20e9aa…` são o corpo cinza do 404 (120×90); `carregar.ts` nunca as usa porque `http != 200`.

Mapeamento `uN` ↔ linha N de `urls-distintas.txt` por ordem, sem script gravado; inócuo porque o dHash é único dentro de cada classe (linhas 1–4 e 14: 1280×720 `686068cfa7a3a3c6`; linhas 5–13: 480×360 `106068cba7a3c3c8`).

## sha256 do recorte

```
2921ab92153d55678baef71c371ee1453803767e53cfce0b8be9bb4cdd7ac120  titulos.tsv
cf6bd43e51a6eb97eb2254deb7a97e860c0a8e7c14fa709b169b2173c57d5c8b  sondas.tsv
660526cfdfda081d3266300731d2399329074df564153cd15ada44cd446e15d1  paginas-watch.tsv
2319af95c5213092cade909591790fcf521fd3279abfd9e1d867ef21211bfda4  dhash.tsv
```

NÃO EDITAR: ampliar só com arquivo novo (`titulos-ate-<data>.tsv`, `sondas-ate-<data>.tsv`).

## Notas

- `TITULO_A` = `5 - Como somos controlados - Consistência e Compromisso (Part 4)`, conferido em 18/10 por leitura pública de `videoDetails.title`. `TITULO_B` = `Consistência e Compromisso (Part 4)`.
- As URLs de página foram truncadas antes de `&rs=`: o dHash dessas linhas é o da imagem canônica, não o da rendição `sqp`; as rendições reais estão em `dhash.tsv` com `origem = sqp-completa-18/10`.
- 8 URLs da watch (28 miniaturas em 7 leituras) surgiram depois do download de 16:44 e ficaram com `http`/`dhash` nulos de propósito.
- A última volta de sondas foi cortada pelo recorte: 2 de 30.
- As URLs `…aLzl_8DDgj…` do `sqp` carregam o varint 1792341745 = 2026-10-18T16:42:25Z, o instante do reenvio, de graça: a S4 deve gravar a URL completa.
- `rendicoesSqp` e `titulo_oficial_fonte`: o experimento não contou as rendições (`null`); a fonte do oficial é `videoDetails`.
