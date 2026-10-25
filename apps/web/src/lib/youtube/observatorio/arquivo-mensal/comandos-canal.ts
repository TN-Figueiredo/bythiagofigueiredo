// apps/web/src/lib/youtube/observatorio/arquivo-mensal/comandos-canal.ts
/** Manutenção M9: o arquivo de comandos de `expurgar --canal` (05 §16.10). Puro: devolve o texto; quem grava é o CLI (umask 077, abertura exclusiva). */
import { UUID_RE } from './contrato'

const PREFIXO_SEGURO = /^(?:numerico|texto|horaria|serie|video_antigo)\/canais\/[0-9a-f-]{36}\/$/
const RAIZ_SEGURA = /^\/[A-Za-z0-9._/-]{1,200}$/
const CLASSES_DO_FILHO: Readonly<Record<'numerico' | 'texto', readonly string[]>> = { numerico: ['horaria', 'serie', 'video_antigo'], texto: ['texto'] }
const aspas = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

export function montarComandosDoCanal(o: {
  channelRef: string; prefixos: Array<{ filho: 'numerico' | 'texto'; prefixo: string }>; raiz: Record<'numerico' | 'texto', string>; geradoEm: Date
}): string {
  if (!UUID_RE.test(o.channelRef)) throw new Error('canal_invalido')
  if (o.prefixos.length === 0) throw new Error('sem_prefixo')
  for (const p of o.prefixos) {
    if (!PREFIXO_SEGURO.test(p.prefixo) || !p.prefixo.includes(`/canais/${o.channelRef}/`)) throw new Error('prefixo_invalido')
    if (!CLASSES_DO_FILHO[p.filho].includes(p.prefixo.split('/')[0]!)) throw new Error('prefixo_filho_incoerente')
    if (!RAIZ_SEGURA.test(o.raiz[p.filho]) || o.raiz[p.filho].includes('..')) throw new Error('raiz_invalida')
  }
  const filhos = [...new Set(o.prefixos.map(p => p.filho))].sort()
  const gerado = Math.floor(o.geradoEm.getTime() / 1000)
  return [
    '#!/bin/bash',
    `# expurgar --canal ${o.channelRef}: gerado em ${o.geradoEm.toISOString()}; vale 24 h; rodado pelo dono na forja`,
    'set -euo pipefail',
    'umask 077',
    "trap '[ \"${OBS_INICIOU:-0}\" = 1 ] || echo \"OBS-ARQUIVO: NÃO RODOU: o arquivo chegou incompleto; nada feito\"' EXIT",
    'obs_canal_main() {',
    '  OBS_INICIOU=1',
    '  [ "$(hostname -s)" = forja ] || { echo "OBS-ARQUIVO: RECUSADO: rode na forja"; return 3; }',
    `  [ "$(date +%s)" -le ${gerado + 86400} ] || { echo "OBS-ARQUIVO: VENCIDO: gere de novo no Mac"; return 4; }`,
    ...filhos.flatMap(f => [
      `  mountpoint -q ${aspas(o.raiz[f])} || { echo "OBS-ARQUIVO: RECUSADO: ${f} desmontado"; return 5; }`,
      `  [ -f ${aspas(o.raiz[f] + '/.arquivo-vivo')} ] || { echo "OBS-ARQUIVO: RECUSADO: ${f} sem sentinela"; return 5; }`,
    ]),
    // o prefixo definitivo e, antes dele, o que o copiador já pôs em `_recebendo/` e na quarentena (Yannis I10)
    '  obs_ok=0; obs_ja=0',
    ...[...new Set(o.prefixos.flatMap(p => [`${p.prefixo}`, `_recebendo/${p.prefixo}`, `_recebendo/_quarentena/${p.prefixo}`].map(rel => `${o.raiz[p.filho]}/${rel}`)))].map(d =>
      `  if [ -d ${aspas(d)} ]; then rm -r --one-file-system -- ${aspas(d)} && obs_ok=$((obs_ok+1)) || { echo ${aspas(`OBS-ARQUIVO: FALHOU: ${d}`)}; return 6; }; else obs_ja=$((obs_ja+1)); fi`),
    `  echo "OBS-ARQUIVO: CANAL ${o.channelRef} APAGADO DO NAS: $obs_ok removido(s), $obs_ja já ausente(s); a conferência do copiador confirma em até 11 h"`,
    '}; obs_canal_main; exit $?',
    '',
  ].join('\n')
}
