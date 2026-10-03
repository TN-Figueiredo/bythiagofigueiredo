# Observatório de Competidores v2 — spikes

## S1 — thumbnail fingerprint (runs: T0 04:55Z, T0b = segunda execução concorrente iniciada ~04:57Z, T1 05:08–05:12Z; T+24h pending)

**Status: PROVISIONAL — re-probe at T+24h pending.** Nenhum A/B teste ativo existia em 2026-10-03 (`ab_tests`: 1 linha, `completed`), então não houve rotação ao vivo para observar. A evidência de rotação vem do histórico do único teste (video `r_3QZBKHqU8`, 7 ciclos, 4 variantes, jun/2026) e de 61 vídeos (1 do A/B Lab + 60 de competidores), 3 execuções da sonda (T0, T0b, T1; 549 linhas = 183 pares vídeo×variante, 3 leituras cada; primeira→última leitura ≈13–17 min).

| question | answer | evidence |
|---|---|---|
| ETag changes on every A/B rotation? | **not testable live; 1 rotation consistent** | O ETag de `r_3QZBKHqU8` é `"1780819252"` = (HIPÓTESE: epoch) 2026-06-07T08:00:52Z; o ciclo 7 (reaplicação do original) começou em 08:00:55.27Z (delta +3 s). Rotações anteriores (ciclos 1–4, 6) foram sobrescritas — não observáveis. 0 rotações ao vivo. |
| ETag changes WITHOUT a rotation (false flip)? | **0 of 183 (video, variante) pares em ≈13–17 min (3 leituras: T0, T0b, T1)** | nenhum id. Janela curta; T+24h pendente. Observação: ETag idêntico entre as 3 variantes em 61 de 61 vídeos (0 divergências). |
| dHash Hamming distance on a real rotation (min) | **10** (original → B); outras: original↔C 29, original↔D 29, B↔C 25, B↔D 25, C↔D 0 (C e D são o mesmo arquivo) | variantes do A/B Lab (blob 1280x720) vs `hqdefault` atual (4:3). Comparação entre formatos diferentes → limite inferior pessimista/ruidoso |
| dHash distance on a false ETag flip (max) | **n/a — 0 false flips**; dHash também estável (0 mudanças) em todos os 183 pares | |
| Last-Modified = rotation minute (± min)? | **no — o header `Last-Modified` NÃO existe** em i.ytimg.com (0 de 549 respostas). **HIPÓTESE (n=1 casamento exato + 18/60 consistentes): o ETag numérico ≠ 0 é o epoch (s) do upload** | delta ETag-epoch vs `started_at` do ciclo: +3 s (1 ponto). Para competidores: 18/60 ETags ≤ 60 min do `published_at`, 13/60 depois (3 h, 76 h → thumbnail trocada depois da publicação) |
| ETag = `"0"` | **29 de 60 vídeos de competidores (48 %) têm ETag `"0"`**, inclusive vídeos publicados hoje | ETag não carrega informação nesses; só o dHash detecta troca. Consequências completas abaixo |
| variant with 200 for every video | **hqdefault** (também mqdefault) | maxresdefault: 404 em 1 de 61 vídeos (`r_3QZBKHqU8`, o do A/B Lab) |

**Decision (PROVISIONAL):** FINGERPRINT = `etag+dhash` · VARIANT = `hqdefault` · DHASH_MAX_SAME = **6** (ruling R19: meio do vão 0..10 entre "0 variação observada" e "menor rotação real observada"; o 0+2=2 da regra do plano é só placeholder, pois variância zero em ≈13–17 min não mede ruído de JPEG nem de CDN) · precision `'min'` from Last-Modified: **not allowed** (header ausente).

**Precisão por ETag (HIPÓTESE, ruling R20):** o site trata o ETag numérico ≠ 0 como instante do upload (hipótese: n=1 casamento exato de +3 s com o ciclo 7 + 18/60 competidores com ETag ≤ 60 min do `published_at`, consistentes). O instante só é usado quando cai DENTRO da janela de observação da mudança; o erro fica então limitado pela janela, e a precisão em minutos é exibida sob essa hipótese até o re-probe T+24h confirmar. Fora da janela, ou com ETag `"0"`, a precisão é a janela de sync (6h).

**ETag `"0"` — regra e consequências (48 % dos vídeos):**
- Regra (R23): o ETag é só um PRÉ-FILTRO do download, nunca registra mudança sozinho. ETag ≠ `"0"` e inalterado → não baixa. ETag ≠ `"0"` e mudou → baixa a imagem e compara o dHash. ETag `"0"` → não há pré-filtro: baixa e compara o dHash em todo sync. Em todos os casos, a mudança de thumbnail só é registrada quando a distância dHash contra o hash armazenado é > DHASH_MAX_SAME = 6.
- Custo: esses vídeos fazem GET + dHash em todo sync. hqdefault medido: mediana 12 754 B, média 15 842 B, máx 45 785 B (183 leituras). ≈48 % dos vídeos × 4 syncs/dia × ≈15,8 KB ≈ 30 KB/dia por vídeo rastreado (≈3 MB/dia a cada 100 vídeos). Desprezível em banda; o custo real é CPU do dHash (sharp) e o número de GETs.
- Lacuna de detecção (TODOS os vídeos, não só ETag `"0"`): re-upload do MESMO arquivo ou de imagem quase idêntica (distância ≤ 6) nunca é registrado, mesmo com o ETag movido (C e D do A/B Lab, distância 0, ficariam invisíveis). Aceito: o espectador não vê diferença, então não há o que registrar.

Ressalvas:
- Nenhuma rotação ao vivo; "ETag muda em toda rotação" tem 1 observação (a reaplicação do ciclo 7), não uma amostra.
- ETag `"0"` (48 %) pode virar timestamp após a primeira troca de thumbnail (provável, não comprovado). Nesse caso o ETag movido (0 → N) apenas dispara o download; quem decide é o dHash (> 6), conforme R23.
- dHash entre formatos diferentes (blob 16:9 vs `hqdefault` 4:3) não é comparável de forma estrita; as distâncias reais de rotação devem ser re-medidas no mesmo formato (`hqdefault` antes/depois) no T+24h/primeira rotação real.
- C e D idênticos (distância 0): re-upload do mesmo arquivo não é detectado por ninguém (nem pelo ETag movido, que só dispara o download); consistente com R23.

Para re-sondar (T+24h). Pré-requisito: `apps/web/.env.local` é gitignored e precisa ser copiado para um worktree novo. O passo A sobrescreve `spike-ids.json` (a lista de competidores muda): para comparar com o T0, copie `spike-ids.json` e `spike-etag.jsonl` do T0 antes, ou PULE o passo A.

```bash
# A (opcional; antes: cp $S/spike-ids.json $S/spike-ids.t0.json)
S=<scratch>; cd <repo>/apps/web && set -a && source .env.local && set +a && REPO=$(git rev-parse --show-toplevel) SCRATCH=$S node $S/collect.cjs   # A
SCRATCH=$S REPO=<repo> node $S/spike-etag.mjs   # B (≈4 min; append em $S/spike-etag.jsonl)
SCRATCH=$S node $S/analyse.mjs                   # C
```

`$S` deve conter os scripts dos apêndices A–F. Extras: `SCRATCH=$S REPO=<repo> node $S/variants.mjs` (D: distâncias das variantes do A/B Lab; lê `spike-data.json`, gerado por A), `SCRATCH=$S node $S/zero-count.mjs` (E: contagem de ETag "0", 404 de maxres, divergência entre variantes, tamanho do hqdefault), `REPO=<repo> SCRATCH=$S node $S/pub.cjs` (F: ETag vs `published_at`; rodar em `apps/web` com `.env.local` carregado).

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

### Apêndice D — `variants.mjs`

```js
import fs from 'node:fs'
import { createRequire } from 'node:module'
const sharp = createRequire(process.env.REPO + '/apps/web/package.json')('sharp')
const d = JSON.parse(fs.readFileSync(process.env.SCRATCH + '/spike-data.json', 'utf8'))
async function dhash(buf) {
  const px = await sharp(buf).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer()
  let bits = ''
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? '1' : '0'
  return BigInt('0b' + bits)
}
const ham = (a, b) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n } return n }
const hs = {}
const yt = d.tests[0].yt
for (const v of d.variants) { const r = await fetch(v.blob_url); hs[v.label] = r.ok ? await dhash(Buffer.from(await r.arrayBuffer())) : null; console.log(v.label, r.status) }
for (const q of ['maxresdefault','hqdefault','mqdefault']) {
  const h = await fetch(`https://i.ytimg.com/vi/${yt}/${q}.jpg`); console.log(q, h.status, h.headers.get('etag'), h.headers.get('last-modified'))
  if (h.ok) hs['current_' + q] = await dhash(Buffer.from(await h.arrayBuffer()))
}
const keys = Object.keys(hs).filter(k => hs[k] != null)
for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) console.log(keys[i], keys[j], ham(hs[keys[i]], hs[keys[j]]))
```

### Apêndice E — `zero-count.mjs`

```js
import fs from 'node:fs'
const rows = fs.readFileSync(process.env.SCRATCH + '/spike-etag.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l))
const hq = rows.filter(r => r.v === 'hqdefault' && r.status === 200)
const zero = new Set(hq.filter(r => r.etag === '"0"').map(r => r.id))
console.log('videos', new Set(hq.map(r => r.id)).size, 'etag "0" videos', zero.size)
console.log('maxres 404 ids', [...new Set(rows.filter(r => r.v === 'maxresdefault' && r.status === 404).map(r => r.id))])
const byId = {}
for (const r of rows.filter(r => r.status === 200)) (byId[r.id] ??= {})[r.v] = r.etag
console.log('videos with differing etag across variants', Object.values(byId).filter(o => new Set(Object.values(o)).size > 1).length)
const len = hq.map(r => +r.length).sort((a, b) => a - b)
console.log('hqdefault bytes median', len[len.length >> 1], 'mean', Math.round(len.reduce((a, b) => a + b) / len.length))
```

### Apêndice F — `pub.cjs`

```js
const { createClient } = require("module").createRequire(process.env.REPO+"/apps/web/package.json")("@supabase/supabase-js");
const fs=require("fs");
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
 const ids=JSON.parse(fs.readFileSync(process.env.SCRATCH+"/spike-ids.json")).comp;
 const {data}=await s.from("competitor_videos").select("video_id,published_at").in("video_id",ids);
 const pub=Object.fromEntries(data.map(r=>[r.video_id,r.published_at]));
 const rows=fs.readFileSync(process.env.SCRATCH+"/spike-etag.jsonl","utf8").trim().split("\n").map(JSON.parse).filter(r=>r.v==="hqdefault"&&r.status===200);
 const seen=new Set();let z=0,same=0,after=0;const ex=[];
 for(const r of rows){if(seen.has(r.id)||!pub[r.id])continue;seen.add(r.id);const e=Number(r.etag.replace(/"/g,""));
  if(!e){z++;ex.push(["zero",pub[r.id].slice(0,10)]);continue}
  const d=(e*1e3-new Date(pub[r.id]))/60000; if(d<=60)same++;else{after++;ex.push(["changed",Math.round(d/60)+"h after publish"])}}
 console.log({videos:seen.size,etagZero:z,etagWithin60minOfPublish:same,etagLater:after});console.log(ex.slice(0,12));
})();
```
