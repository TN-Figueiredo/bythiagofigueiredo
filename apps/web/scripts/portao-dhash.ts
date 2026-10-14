// Portão do dHash (P4-0 do A/B Lab, spec 3.4). `valer`, `devolver` e `conferir` são do DONO; agente roda só `ensaio` e `distancias`.
//   bash scripts/portao-dhash.sh <ensaio|valer|devolver|conferir> <id> [--aceitar-menor]
//   bash scripts/portao-dhash.sh distancias <a.jpg> <b.jpg> [...]
// Pasta de trabalho: ~/portao-dhash/<id>/ (cópia da original, estado.json, registro.jsonl, resultado.md).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { probeThumb } from '../src/lib/youtube/thumb-fingerprint'
import { lerArgs, Recusa } from '../src/lib/youtube/portao-dhash/regras'
import { Diario } from '../src/lib/youtube/portao-dhash/diario'
import { distancias } from '../src/lib/youtube/portao-dhash/imagem'
import { conferir, devolver, ensaio, valer, type Deps, type Sinal } from '../src/lib/youtube/portao-dhash/executar'

const dormir = (ms: number, sinal: Sinal) => new Promise<void>((r) => {
  const t0 = Date.now()
  const i = setInterval(() => { if (sinal.parar || Date.now() - t0 >= ms) { clearInterval(i); r() } }, 1_000)
})
const dizer = (l: string) => { try { console.log(l) } catch { /* terminal fechado: o registro.jsonl continua */ } }

async function main(): Promise<number> {
  const a = lerArgs(process.argv.slice(2))
  if (!a.ok) { console.error(a.erro); return 2 }
  if (a.comando === 'distancias') {
    for (const l of await distancias(a.arquivos.map((p) => fs.readFileSync(p)), a.arquivos)) dizer(l)
    return 0
  }
  const sinal: Sinal = { parar: false }
  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(s, () => {
      if (sinal.parar) { dizer('já estou parando: a original está sendo devolvida; espere'); return }
      sinal.parar = true
      dizer('parando: vou devolver a original antes de sair')
    })
  }
  const d: Deps = {
    video: a.video,
    diario: new Diario(path.join(os.homedir(), 'portao-dhash', a.video), Date.now),
    f: fetch,
    sondar: async (v) => { const p = await probeThumb(v, null); return { dhash: p.dhash, etag: p.etag } },
    // import tardio: o ensaio nunca carrega banco nem credencial
    escritor: async () => (await import('../src/lib/youtube/portao-dhash/youtube')).escritorDoCanal(a.video),
    agora: Date.now, dormir, sinal, log: dizer,
  }
  const s = a.comando === 'ensaio' ? await ensaio(d, a.aceitarMenor)
    : a.comando === 'valer' ? await valer(d, a.aceitarMenor)
    : a.comando === 'devolver' ? await devolver(d)
    : await conferir(d)
  dizer(s.mensagem)
  return s.codigo
}

main().then((c) => process.exit(c), (e: unknown) => {
  if (e instanceof Recusa) { console.error(`recusado: ${e.message}`); process.exit(2) }
  console.error(`falha: ${e instanceof Error ? e.message : String(e)}. Veja ~/portao-dhash/<id>/estado.json; se a fase não for "preparado", rode: bash scripts/portao-dhash.sh devolver <id>`)
  process.exit(1)
})
