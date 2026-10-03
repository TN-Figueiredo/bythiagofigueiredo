# Observatório de Competidores v2 — spikes

## S1 — thumbnail fingerprint (runs: T0 01:55 -03, T0b +4 min, T1 +13 min; T+24h pending)

**Status: PROVISIONAL — re-probe at T+24h pending.** Nenhum A/B teste ativo existia em 2026-10-03 (`ab_tests`: 1 linha, `completed`), então não houve rotação ao vivo para observar. A evidência de rotação vem do histórico do único teste (video `r_3QZBKHqU8`, 7 ciclos, 4 variantes, jun/2026) e de 61 vídeos (1 do A/B Lab + 60 de competidores), 3 execuções da sonda (549 linhas = 183 pares vídeo×variante, 3 leituras cada).

| question | answer | evidence |
|---|---|---|
| ETag changes on every A/B rotation? | **not testable live; 1 rotation consistent** | O ETag de `r_3QZBKHqU8` é `"1780819252"` = epoch 2026-06-07T08:00:52Z; o ciclo 7 (reaplicação do original) começou em 08:00:55.27Z (delta +3 s). Rotações anteriores (ciclos 1–4, 6) foram sobrescritas — não observáveis. 0 rotações ao vivo. |
| ETag changes WITHOUT a rotation (false flip)? | **0 of 183 (video, variante) pares em ~13 min (3 leituras, 2 delas ~4 min)** | nenhum id. Janela curta; T+24h pendente. ETag idêntico entre as 3 variantes de um mesmo vídeo (0 divergências). |
| dHash Hamming distance on a real rotation (min) | **10** (original → B); outras: original↔C 29, original↔D 29, B↔C 25, B↔D 25, C↔D 0 (C e D são o mesmo arquivo) | variantes do A/B Lab (blob 1280x720) vs `hqdefault` atual (4:3). Comparação entre formatos diferentes → limite inferior pessimista/ruidoso |
| dHash distance on a false ETag flip (max) | **n/a — 0 false flips**; dHash também estável (0 mudanças) em todos os 183 pares | |
| Last-Modified = rotation minute (± min)? | **no — o header `Last-Modified` NÃO existe** em i.ytimg.com (0 de 549 respostas). **Mas o ETag numérico é o epoch (s) do upload** | delta ETag-epoch vs `started_at` do ciclo: +3 s (1 ponto). Para competidores: 18/60 ETags ≤ 60 min do `published_at`, 13/60 depois (3 h, 76 h → thumbnail trocada depois da publicação) |
| ETag = `"0"` | **29 de 60 vídeos de competidores (48 %) têm ETag `"0"`**, inclusive vídeos publicados hoje | ETag não carrega informação nesses; só o dHash detecta troca |
| variant with 200 for every video | **hqdefault** (também mqdefault) | maxresdefault: 404 em 1 de 61 vídeos (`r_3QZBKHqU8`, o do A/B Lab) |

**Decision (PROVISIONAL):** FINGERPRINT = `etag+dhash` (ETag como pré-filtro barato quando ≠ `"0"`; quando `"0"` não há pré-filtro, baixar e calcular dHash a cada sync) · VARIANT = `hqdefault` · DHASH_MAX_SAME = `2` (regra do plano: máx. observado em false flips 0 + 2; mínimo real de rotação observado 10 deixa folga) · precision `'min'` from Last-Modified: **not allowed** (header ausente). Alternativa: o ETag numérico é o epoch do upload, então `precision: 'min'` é **plausível a partir do ETag quando ≠ `"0"`** (1 ponto de verificação, delta 3 s) — confirmar no T+24h com competidores que rotacionam; até lá a precisão do thumbnail é a janela de sync (6h), exceto quando o ETag ≠ `"0"` e o epoch está disponível.

Ressalvas:
- Nenhuma rotação ao vivo; "ETag muda em toda rotação" tem 1 observação (a reaplicação do ciclo 7), não uma amostra.
- ETag `"0"` (48 %) pode virar timestamp após a primeira troca de thumbnail (provável, não comprovado) — o fluxo etag+dhash cobre esse caso porque 0 → N é flip e dHash confirma.
- dHash entre formatos diferentes (blob 16:9 vs `hqdefault` 4:3) não é comparável de forma estrita; as distâncias reais de rotação devem ser re-medidas no mesmo formato (`hqdefault` antes/depois) no T+24h/primeira rotação real.
- C e D idênticos (distância 0): dHash sozinho não detecta re-upload do mesmo arquivo — o ETag sim.

Para re-sondar (T+24h): colete ids (apêndice A), rode a sonda (B) e analise (C):

```bash
S=<scratch>; cd <repo>/apps/web && set -a && source .env.local && set +a && REPO=$(git rev-parse --show-toplevel) SCRATCH=$S node $S/collect.cjs   # A
SCRATCH=$S REPO=<repo> node $S/spike-etag.mjs   # B (≈4 min; append em $S/spike-etag.jsonl)
SCRATCH=$S node $S/analyse.mjs                   # C
```

(`$S` deve conter `collect.cjs`, `spike-etag.mjs`, `analyse.mjs`, copiados do apêndice. Para comparar com o T0, reaproveite o mesmo `spike-ids.json` e `spike-etag.jsonl`; os ids de competidores podem ter mudado — se re-coletar, use a lista antiga.)

### Apêndice A — `collect.cjs` (somente SELECT)

```js
const { createClient } = require("module").createRequire(process.env.REPO+"/apps/web/package.json")("@supabase/supabase-js");
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const all = await s.from("ab_tests").select("id,status,youtube_video_id,test_type,started_at,round_number,original_thumbnail_url").order("started_at",{ascending:false}).limit(60);
  if (all.error) throw all.error;
  const st = {}; all.data.forEach(r=>st[r.status]=(st[r.status]||0)+1);
  const active = all.data.filter(r=>r.status==="active");
  const vids = await s.from("youtube_videos").select("id,youtube_video_id").in("id", all.data.map(r=>r.youtube_video_id));
  const map = Object.fromEntries((vids.data??[]).map(v=>[v.id,v.youtube_video_id]));
  const tests = all.data.map(t=>({...t, yt: map[t.youtube_video_id] ?? t.youtube_video_id}));
  const ids = tests.map(t=>t.id);
  const cyc = await s.from("ab_test_cycles").select("id,test_id,variant_id,cycle_number,started_at,ended_at").in("test_id", ids).order("started_at");
  const vars = await s.from("ab_test_variants").select("id,test_id,label,is_original,blob_url").in("test_id", ids);
  const comp = await s.from("competitor_videos").select("video_id").order("published_at",{ascending:false}).limit(60);
  console.error("status counts", JSON.stringify(st), "active", active.length, "cycles", cyc.data?.length, "variants", vars.data?.length, cyc.error, vars.error);
  require("fs").writeFileSync(process.env.SCRATCH+"/spike-data.json", JSON.stringify({tests, cycles:cyc.data, variants:vars.data, comp:(comp.data??[]).map(r=>r.video_id)}));
  require("fs").writeFileSync(process.env.SCRATCH+"/spike-ids.json", JSON.stringify({ ab: [...new Set(tests.filter(t=>t.status==="active").map(t=>t.yt))], comp:(comp.data??[]).map(r=>r.video_id), abHist:[...new Set(tests.map(t=>t.yt))] }));
})();
```

### Apêndice B — `spike-etag.mjs`

```js
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(process.env.REPO + '/apps/web/package.json') // resolve sharp from the repo
const sharp = require('sharp')
const ids = JSON.parse(fs.readFileSync(process.env.SCRATCH + '/spike-ids.json', 'utf8'))
const VARIANTS = ['maxresdefault', 'hqdefault', 'mqdefault']
async function dhash(buf) {
  const px = await sharp(buf).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer()
  let bits = ''
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? '1' : '0'
  return BigInt('0b' + bits).toString(16).padStart(16, '0')
}
const list = [...new Set([...ids.ab, ...(ids.abHist ?? []), ...ids.comp])]
const out = []
for (const id of list) for (const v of VARIANTS) {
  const url = `https://i.ytimg.com/vi/${id}/${v}.jpg`
  const head = await fetch(url, { method: 'HEAD' })
  const get = head.ok ? await fetch(url) : null
  const buf = get ? Buffer.from(await get.arrayBuffer()) : null
  out.push({ at: new Date().toISOString(), id, v, ab: (ids.abHist ?? ids.ab).includes(id), status: head.status,
    etag: head.headers.get('etag'), lastModified: head.headers.get('last-modified'),
    length: head.headers.get('content-length'), dhash: buf ? await dhash(buf) : null })
}
fs.appendFileSync(process.env.SCRATCH + '/spike-etag.jsonl', out.map(o => JSON.stringify(o)).join('\n') + '\n')
console.log(out.length, 'rows')
```

### Apêndice C — `analyse.mjs`

```js
import fs from 'node:fs'
const rows = fs.readFileSync(process.env.SCRATCH + '/spike-etag.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l))
const ham = (a, b) => { let x = BigInt('0x'+a) ^ BigInt('0x'+b), n = 0; while (x) { n += Number(x & 1n); x >>= 1n } return n }
const runs = [...new Set(rows.map(r => r.at.slice(0, 16)))]
console.log('rows', rows.length, 'rows-by-run-minute', runs.length)
const by = {}
for (const r of rows) (by[r.id + '|' + r.v] ??= []).push(r)
const stat = {}
for (const v of ['maxresdefault','hqdefault','mqdefault']) { const rs = rows.filter(r=>r.v===v); const s = {}; rs.forEach(r=>s[r.status]=(s[r.status]||0)+1); console.log(v, s, 'lastModified present', rs.filter(r=>r.lastModified).length, 'etag present', rs.filter(r=>r.etag).length) }
let flips=0, dflips=0, n=0, maxd=0
for (const [k, a] of Object.entries(by)) { if (a.length<2) continue; n++
  const f = a.at(-1), z = a[0]
  if (f.etag !== z.etag) { flips++; console.log('ETAG FLIP', k, z.etag, f.etag, f.dhash&&z.dhash?ham(f.dhash,z.dhash):'-') }
  if (f.dhash && z.dhash && f.dhash!==z.dhash) { dflips++ ; maxd=Math.max(maxd,ham(f.dhash,z.dhash)) } }
console.log('pairs', n, 'etag flips', flips, 'dhash changes', dflips)
const e = rows.filter(r=>r.status===200 && r.v==='hqdefault').slice(0,5).map(r=>[r.id,r.etag,r.etag&&new Date(Number(r.etag.replace(/"/g,''))*1000).toISOString()]); console.log(e)
```
