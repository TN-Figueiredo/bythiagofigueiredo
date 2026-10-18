import type { SupabaseClient } from '@supabase/supabase-js'
import { claimAlert, releaseAlert } from '@/lib/ops/alert-state'
import { fanOutToSiteAdminsDetailed } from '@/lib/notifications/fan-out-to-admins'
import type { CampoNome, CampoRestauracao, RestoreStatus } from '@/lib/youtube/ab-restore'

export type ResultadoAviso = 'enviado' | 'sem_destinatario' | 'repetido' | 'falha_de_envio'
type Teste = { id: string; site_id: string; name: string; restore_seq: number }

const CAMPOS: CampoNome[] = ['title', 'thumbnail']
const JANELA_UNICA = '3650 days' // um aviso por chave, para sempre: a chave já carrega o restore_seq
// Quanto maior o resultado, mais o chamador precisa saber dele (cron: SEM_DESTINATARIO/adiados).
const PESO: Record<ResultadoAviso, number> = { repetido: 0, enviado: 1, sem_destinatario: 2, falha_de_envio: 3 }

const nomeDoCampo = (c: CampoNome) => (c === 'title' ? 'título' : 'thumbnail')

/** Texto de `falhou` (Logan fecha na T17): só afirma "o YouTube recusou" quando a chamada foi de escrita (F-D10). */
export function fraseDeFalha(nome: string, campo: CampoNome, c: CampoRestauracao): string {
  const recusou =
    typeof c.erro === 'object' && c.erro !== null && 'chamada' in c.erro &&
    (c.erro.chamada === 'videos.update' || c.erro.chamada === 'thumbnails.set')
  const sujeito = campo === 'title' ? 'O título' : 'A thumbnail'
  const verbo = c.destino === 'original' ? 'não voltou ao original' : 'não ficou na versão escolhida'
  const causa = recusou ? 'o YouTube recusou' : 'o Lab não conseguiu concluir'
  return `${sujeito} do teste "${nome}" ${verbo}: ${causa}. Corrija no YouTube Studio.`
}

function oQue(campos: CampoNome[]): string {
  if (campos.length === 2) return 'o título e a thumbnail'
  return campos[0] === 'title' ? 'o título' : 'a thumbnail'
}

/** Texto de `desistiu`, literal (Logan). */
export function fraseDeDesistencia(nome: string, motivo: string | null | undefined, campos: CampoNome[]): string {
  const resto = `O Lab não vai mais tentar restaurar ${oQue(campos)}.`
  return motivo === 'novo_teste'
    ? `Outro teste começou no vídeo do teste "${nome}". ${resto}`
    : `O vídeo do teste "${nome}" não foi encontrado no YouTube. ${resto}`
}

/**
 * P-4: um aviso por (teste, restore_seq, campo) em `falhou`; um aviso na transição para `desistiu` (chave sem seq).
 * `sem_destinatario` e `falha_de_envio` liberam a chave (a próxima tentativa avisa) e sobem ao chamador (Y-P3).
 */
export async function avisarRestauracao(supabase: SupabaseClient, teste: Teste, rs: RestoreStatus): Promise<ResultadoAviso> {
  let resultado: ResultadoAviso = 'repetido'
  const sobe = (r: ResultadoAviso) => { if (PESO[r] > PESO[resultado]) resultado = r }
  const href = `/cms/youtube/ab-lab/${teste.id}`

  const enviar = async (chaves: string[], extra: { priority: number; title: string; message: string; campo: CampoNome[] }) => {
    let r: Awaited<ReturnType<typeof fanOutToSiteAdminsDetailed>>
    try {
      r = await fanOutToSiteAdminsDetailed({
        siteId: teste.site_id, domain: 'youtube', type: 'youtube.ab_restore_failed', priority: extra.priority,
        title: extra.title, message: extra.message, dedupKey: chaves[0]!, actionHref: href,
        payload: { testId: teste.id, restoreSeq: teste.restore_seq, campos: extra.campo },
      })
    } catch (e) {
      for (const k of chaves) await releaseAlert(supabase, k) // exceção no envio: a chave não pode ficar gasta por 10 anos
      throw e
    }
    if (r.sent === 0 && r.suppressed > 0 && r.errors.length === 0) { sobe('repetido'); return } // dedup do fan-out: já avisado
    if (r.total === 0 || r.sent === 0) {
      for (const k of chaves) await releaseAlert(supabase, k) // nenhuma chave do grupo fica gasta sem aviso entregue
      sobe(r.total === 0 ? 'sem_destinatario' : 'falha_de_envio')
      return
    }
    sobe('enviado')
  }

  for (const campo of CAMPOS) {
    const c = rs[campo]
    if (c?.estado !== 'falhou') continue
    const chave = `ab-restore:${teste.id}:${teste.restore_seq}:${campo}`
    if (!(await claimAlert(supabase, chave, JANELA_UNICA))) continue
    await enviar([chave], { priority: 1, title: 'A/B: o vídeo não voltou ao combinado', message: fraseDeFalha(teste.name, campo, c), campo: [campo] })
  }

  // desistiu: um aviso só por motivo, listando os campos que acabaram de ser reivindicados (chave por campo, sem seq).
  const porMotivo = new Map<string, CampoNome[]>()
  for (const campo of CAMPOS) {
    const c = rs[campo]
    if (c?.estado !== 'desistiu') continue
    if (!(await claimAlert(supabase, `ab-restore-desistiu:${teste.id}:${campo}`, JANELA_UNICA))) continue
    const m = c.motivo ?? 'video_inexistente'
    porMotivo.set(m, [...(porMotivo.get(m) ?? []), campo])
  }
  for (const [motivo, campos] of porMotivo) {
    const chaves = campos.map((campo) => `ab-restore-desistiu:${teste.id}:${campo}`)
    await enviar(chaves, { priority: 3, title: 'A/B: o Lab parou de restaurar o vídeo', message: fraseDeDesistencia(teste.name, motivo, campos), campo: campos })
  }
  return resultado
}
