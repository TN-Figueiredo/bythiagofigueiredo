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
import { protegerSaida, sinalRepetido } from '../src/lib/youtube/portao-dhash/saida'
import { codigoDeFalha, conferir, devolver, ensaio, valer, type Deps, type Sinal } from '../src/lib/youtube/portao-dhash/executar'

const dormir = (ms: number, sinal: Sinal) => new Promise<void>((r) => {
  const t0 = Date.now()
  const i = setInterval(() => { if (sinal.parar || Date.now() - t0 >= ms) { clearInterval(i); r() } }, 1_000)
})
const dizer = (l: string) => { try { console.log(l) } catch { /* terminal fechado: o registro.jsonl continua */ } }
const dizerErro = (l: string) => { try { console.error(l) } catch { /* idem */ } }

async function main(): Promise<number> {
  protegerSaida([process.stdout, process.stderr]) // SIGHUP: sem isto o EIO mata o processo antes da devolução
  const a = lerArgs(process.argv.slice(2))
  if (!a.ok) { dizerErro(a.erro); return 2 }
  if (a.comando === 'distancias') {
    for (const l of await distancias(a.arquivos.map((p) => fs.readFileSync(p)), a.arquivos)) dizer(l)
    return 0
  }
  const sinal: Sinal = { parar: false }
  let ultimoSinalEm: number | null = null
  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(s, () => {
      const agora = Date.now(), repetido = sinalRepetido(ultimoSinalEm, agora)
      ultimoSinalEm = agora
      if (repetido) return // o tsx repassa o mesmo Ctrl-C ao filho
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
    escritor: async () => {
      // o token precisa renovar na devolução, até 12 h depois da troca: checar antes de escrever
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new Recusa('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET precisam estar no .env.local (o refresh do token depende deles)')
      return (await import('../src/lib/youtube/portao-dhash/youtube')).escritorDoCanal(a.video)
    },
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
  // lançou fora do contrato: se a troca pode estar no ar, sai 3 com o comando; Recusa sem troca sai 2
  const a = lerArgs(process.argv.slice(2))
  if (!a.ok || a.comando === 'distancias') { dizerErro(`falha: ${e instanceof Error ? e.message : String(e)}`); process.exit(e instanceof Recusa ? 2 : 1) }
  const s = codigoDeFalha(new Diario(path.join(os.homedir(), 'portao-dhash', a.video), Date.now), a.video, e)
  dizerErro(s.mensagem)
  process.exit(s.codigo)
})
