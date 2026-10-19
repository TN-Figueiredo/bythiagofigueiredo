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

/** Texto de `desistiu`, literal (Logan). Motivos da P4b: `tres_falhas`, `destino_invalido` (TEXTO-A-REVISAR). */
export function fraseDeDesistencia(nome: string, motivo: string | null | undefined, campos: CampoNome[], noAr?: string | null): string {
  const resto = `O Lab não vai mais tentar restaurar ${oQue(campos)}.`
  switch (motivo) {
    case 'novo_teste':
      return `Outro teste começou no vídeo do teste "${nome}". ${resto}`
    case 'video_inexistente':
      return `O vídeo do teste "${nome}" não foi encontrado no YouTube. ${resto}`
    case 'tres_falhas': // TEXTO-A-REVISAR
      return `A restauração do teste "${nome}" falhou 3 vezes e parou. ${noAr ? `No ar continua a variante ${noAr}.` : 'No ar continua o que estava antes.'} Corrija no YouTube Studio.`
    case 'destino_invalido': // TEXTO-A-REVISAR
      return `Não consegui saber para qual versão devolver o vídeo do teste "${nome}"; confira no YouTube Studio. ${resto}`
    default: // antes_da_nova_tentativa e futuros: neutro, sem afirmar o que não se sabe
      return `O Lab parou de restaurar o vídeo do teste "${nome}". ${resto}`
  }
}

type Envio = { priority: number; title: string; message: string; campo: CampoNome[]; dedupKey?: string }
type Enviar = (chaves: string[], extra: Envio) => Promise<void>

/** Envio com a regra de liberação de chave de P-4 (Y-P3), compartilhado por `avisarRestauracao` e `avisarNovaTentativa`. */
function emissor(supabase: SupabaseClient, teste: { id: string; site_id: string }, restoreSeq: number | null) {
  let resultado: ResultadoAviso = 'repetido'
  const sobe = (r: ResultadoAviso) => { if (PESO[r] > PESO[resultado]) resultado = r }
  const href = `/cms/youtube/ab-lab/${teste.id}`
  const enviar: Enviar = async (chaves, extra) => {
    let r: Awaited<ReturnType<typeof fanOutToSiteAdminsDetailed>>
    try {
      r = await fanOutToSiteAdminsDetailed({
        siteId: teste.site_id, domain: 'youtube', type: 'youtube.ab_restore_failed', priority: extra.priority,
        title: extra.title, message: extra.message, dedupKey: extra.dedupKey ?? chaves[0]!, actionHref: href,
        payload: { testId: teste.id, ...(restoreSeq !== null ? { restoreSeq } : {}), campos: extra.campo },
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
  return { enviar, resultado: () => resultado }
}

// desistiu: um aviso só por motivo, listando os campos que acabaram de ser reivindicados (chave por campo, sem seq).
async function avisarDesistencias(supabase: SupabaseClient, teste: { id: string; name: string }, rs: RestoreStatus, enviar: Enviar, noAr: string | null): Promise<void> {
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
    // dedup_key de notifications é único para sempre: a chave do fan-out leva o `em` da corrente que parou, senão o
    // "parou" seguinte do mesmo campo (depois de "Tentar agora") sairia suprimido. Na mesma corrente o `em` não muda.
    const dedupKey = `${chaves[0]}:${rs[campos[0]!]!.em}`
    await enviar(chaves, { priority: 3, title: 'A/B: o Lab parou de restaurar o vídeo', message: fraseDeDesistencia(teste.name, motivo, campos, noAr), campo: campos, dedupKey })
  }
}

/**
 * P-4: um aviso por (teste, restore_seq, campo) em `falhou`; um aviso na transição para `desistiu` (chave sem seq).
 * `sem_destinatario` e `falha_de_envio` liberam a chave (a próxima tentativa avisa) e sobem ao chamador (Y-P3).
 */
export async function avisarRestauracao(supabase: SupabaseClient, teste: Teste, rs: RestoreStatus): Promise<ResultadoAviso> {
  const { enviar, resultado } = emissor(supabase, teste, teste.restore_seq)
  for (const campo of CAMPOS) {
    const c = rs[campo]
    if (c?.estado !== 'falhou') continue
    const chave = `ab-restore:${teste.id}:${teste.restore_seq}:${campo}`
    if (!(await claimAlert(supabase, chave, JANELA_UNICA))) continue
    await enviar([chave], { priority: 1, title: 'A/B: o vídeo não voltou ao combinado', message: fraseDeFalha(teste.name, campo, c), campo: [campo] })
  }
  await avisarDesistencias(supabase, teste, rs, enviar, null)
  return resultado()
}

export const JANELA_DO_AVISO_DIARIO = '20 hours' // F6/Y-7: cron às 10:00 e 20:00 UTC; '1 day' pularia dias ao acaso

/**
 * P4b: depois de uma tentativa do vigia. Enquanto houver `falhou`, um aviso a cada 20 h (chave `ab-restore:<id>`);
 * sem `falhou` a chave é liberada. `desistiu` avisa uma vez por campo (a chave é liberada quando o campo sai de `desistiu`).
 */
export async function avisarNovaTentativa(
  supabase: SupabaseClient,
  teste: { id: string; site_id: string; name: string },
  rs: RestoreStatus,
  noAr: string | null,
): Promise<ResultadoAviso> {
  const { enviar, resultado } = emissor(supabase, teste, null)
  const chave = `ab-restore:${teste.id}`
  const campo = CAMPOS.find((c) => rs[c]?.estado === 'falhou')
  if (campo) {
    if (await claimAlert(supabase, chave, JANELA_DO_AVISO_DIARIO)) {
      // dedup_key de notifications é único para sempre: o aviso repetido precisa de chave própria por envio.
      await enviar([chave], {
        priority: 1, title: 'A/B: o vídeo não voltou ao combinado', message: fraseDeFalha(teste.name, campo, rs[campo]!), campo: [campo],
        dedupKey: `${chave}:${new Date().toISOString().slice(0, 13)}`,
      })
    }
  } else {
    await releaseAlert(supabase, chave)
  }
  await avisarDesistencias(supabase, teste, rs, enviar, noAr)
  return resultado()
}
