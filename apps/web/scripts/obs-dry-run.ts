/**
 * Ensaio a seco da leitura dos concorrentes (§8.0). SÓ LEITURA: lê arquivos de export, não importa cliente Supabase e não grava nada.
 * Uso: cd apps/web && npx tsx --require ./scripts/_sem-server-only.cjs scripts/obs-dry-run.ts <export.json…> [--agora <ISO>]
 * O export vem de scripts/obs-dry-run.sql (cabeçalho traz o comando). Vários arquivos são unidos por alvo.
 */
import { readFileSync } from 'node:fs'
import { carregarExport, ensaiar, extrairLinhas, relatorioEmTexto, type LinhaExport } from '../src/lib/youtube/teste-youtube/observados/ensaio'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const arquivos: string[] = []
  let agora: string | null = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agora') { agora = args[++i] ?? null; continue }
    arquivos.push(args[i]!)
  }
  if (arquivos.length === 0) throw new Error('uso: obs-dry-run.ts <export.json…> [--agora <ISO>]')
  const linhas: LinhaExport[] = arquivos.flatMap(f => extrairLinhas(readFileSync(f, 'utf8')))
  if (linhas.length === 0) throw new Error('export vazio')
  const alvos = carregarExport(linhas)
  const maior = linhas.reduce((m, l) => Math.max(m, Date.parse(l.lida_em.replace(' ', 'T').replace(/\+00(:00)?$/, 'Z'))), 0)
  const agoraMs = agora !== null ? Date.parse(agora) : maior
  if (!Number.isFinite(agoraMs)) throw new Error('--agora inválido')
  console.log(`Arquivos: ${arquivos.length}; linhas: ${linhas.length}; alvos: ${alvos.size}`)
  console.log(relatorioEmTexto(await ensaiar(alvos, { agoraMs })))
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
