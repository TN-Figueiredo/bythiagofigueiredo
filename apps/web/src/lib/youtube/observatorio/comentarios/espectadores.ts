// A5 · F2-coleta (7c): "Espectador N" dentro de UM fio, sem guardar chave nenhuma. Puro: sem banco, rede, relógio nem log.
// O `authorChannelId` entra e não sai: serve só para reconhecer, dentro desta coleta, a mesma pessoa falando duas vezes.
// Nada daqui vai a log, erro nem Sentry; a saída é só `{ id, speakerNo }`.
import type { Conversa } from './tipos'

export interface NumeroDeEspectador { id: string; speakerNo: number }

/**
 * Numera as respostas de espectadores do fio (as do criador nunca entram).
 * - `guardados`: id de resposta de espectador JÁ gravada neste fio -> seu `speaker_no` (o chamador agrupa por fio uma vez, O(G)).
 * - `maiorGuardado`: maior `speaker_no` do fio no banco (0 se nenhum), mesmo que ele não tenha vindo neste lote.
 * Regras: o autor do topo (quando não é o criador) é sempre o 1, tenha ou não canal legível; resposta sem canal ganha número novo
 * (nunca "mesma pessoa"); quem já falou e voltou herda o número guardado, o MENOR se houver dois; gravada devolve o número guardado.
 * Quem é novo recebe `max(maiorGuardado, 1 se há topo de espectador, maiores guardados vistos) + 1`, na ordem das respostas.
 */
export function numerarEspectadores(
  c: Conversa, canalDoVideo: string, guardados: ReadonlyMap<string, number>, maiorGuardado: number,
): NumeroDeEspectador[] {
  void canalDoVideo // o filtro do criador já foi feito na normalização; mantido na assinatura para o chamador não decidir sozinho
  const respostas = c.respostasDeTerceiros
    .map((r, i) => ({ r, i }))
    .sort((a, b) => Date.parse(a.r.publicadoEm) - Date.parse(b.r.publicadoEm) || a.i - b.i)
    .map(({ r }) => r)
  const doTopo = !c.doCriador
  const porCanal = new Map<string, number>()
  if (doTopo && c.autor.canalId !== null) porCanal.set(c.autor.canalId, 1)
  let maior = Math.max(maiorGuardado, doTopo ? 1 : 0)
  // quem já falou e foi gravado: o canal desta leitura herda o menor número guardado
  for (const r of respostas) {
    const n = guardados.get(r.id)
    if (n === undefined) continue
    maior = Math.max(maior, n)
    if (r.autorCanalId === null) continue
    const atual = porCanal.get(r.autorCanalId)
    if (atual === undefined || n < atual) porCanal.set(r.autorCanalId, n)
  }
  const saida: NumeroDeEspectador[] = []
  for (const r of respostas) {
    const gravado = guardados.get(r.id)
    if (gravado !== undefined) { saida.push({ id: r.id, speakerNo: gravado }); continue }
    const conhecido = r.autorCanalId === null ? undefined : porCanal.get(r.autorCanalId)
    if (conhecido !== undefined) { saida.push({ id: r.id, speakerNo: conhecido }); continue }
    maior += 1
    if (r.autorCanalId !== null) porCanal.set(r.autorCanalId, maior)
    saida.push({ id: r.id, speakerNo: maior })
  }
  return saida
}
