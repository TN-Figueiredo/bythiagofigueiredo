/**
 * Peça 7 (M3b-forja, Tarefa 7a, D-F24/D-F25): o script `bash` que o Mac imprime e o `ssh forja 'bash -s'` roda na forja.
 * Puro. Todo valor do banco entra entre aspas simples; toda saída termina numa linha `OBS-ARQUIVO: ...`.
 */
import type { LeituraPendencias } from '../arquivo-mensal/pendencias'

export const aspas = (v: string): string => `'${v.replace(/'/g, `'\\''`)}'`

export function scriptDeFalha(frase: string): string[] {
  return [
    '#!/bin/bash',
    '# obs:arquivo: script de falha (o Mac não conseguiu gerar os passos)',
    `echo ${aspas('OBS-ARQUIVO: NÃO RODOU: ' + frase.replace(/^obs:arquivo:\s*/, ''))} >&2`,
    'exit 1',
  ]
}

/** Defesa na borda: com código ≠ 0 a saída nunca é texto cru que o bash da forja executaria. */
export function saidaSegura(r: { codigo: number; saida: string[]; erros?: string[] }): string[] {
  if (r.codigo === 0 || r.saida[0] === '#!/bin/bash') return r.saida
  return scriptDeFalha(r.erros?.[0] ?? r.saida[0] ?? 'obs:arquivo: falha sem frase')
}

const dataBr = (d: Date): string => {
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const g = (t: string): string => p.find(x => x.type === t)?.value ?? '??'
  return `${g('day')}/${g('month')} ${g('hour')}:${g('minute')}`
}

const CORPO_ABRE = [
  'trap \'[ -n "${OBS_CHAMADO:-}" ] || { echo "OBS-ARQUIVO: NÃO RODOU: o script chegou incompleto; nada feito" >&2; exit 1; }\' EXIT',
  'obs_arquivo_main() {',
  '  OBS_CHAMADO=1',
  '  set -u',
  '  if [ "$(hostname -s)" != forja ]; then echo "OBS-ARQUIVO: NÃO RODOU: este script roda na forja (ssh forja \'bash -s\'); nada feito aqui" >&2; return 3; fi',
  '  local M="${ARQ_MONTAGEM_ESCRITA:-/mnt/arquivo/escrita}" falhas=0 apagados=0 ja=0 esperando=0',
]
const FUNCAO = [
  '  apaga_conferido() {   # filho caminho sha256 nova_caminho nova_sha256 (os dois últimos vazios = sem versão nova a exigir)',
  '    local base="$M/$1" alvo="$M/$1/$2"',
  '    if ! mountpoint -q "$base" || [ ! -f "$base/.arquivo-vivo" ]; then echo "PULADO $1/$2: o NAS não está montado ou sem a sentinela" >&2; falhas=$((falhas+1)); return 0; fi',
  '    if [ -n "$4" ] && { [ ! -f "$base/$4" ] || [ "$(sha256sum < "$base/$4" | cut -c1-64)" != "$5" ]; }; then echo "PULADO $1/$2: a versão nova não está no NAS como o site registrou" >&2; falhas=$((falhas+1)); return 0; fi',
  '    if [ ! -e "$alvo" ]; then echo "JA-APAGADO $1/$2"; ja=$((ja+1)); return 0; fi',
  '    if [ "$(sha256sum < "$alvo" | cut -c1-64)" != "$3" ]; then echo "PULADO $1/$2: o arquivo no NAS não é o que o site registrou" >&2; falhas=$((falhas+1)); return 0; fi',
  '    if rm -- "$alvo"; then echo "APAGADO $1/$2"; apagados=$((apagados+1)); elif [ ! -e "$alvo" ]; then echo "JA-APAGADO $1/$2"; ja=$((ja+1)); else echo "PULADO $1/$2: o rm falhou" >&2; falhas=$((falhas+1)); fi',
  '  }',
]
const TRAVA = [
  '  T="${ARQ_TRAVA_COPIADOR:-/opt/arquivo/copiador.lock}"',
  '  [ -r "$T" ] && exec 9<"$T" && flock -n 9 || { echo "OBS-ARQUIVO: NÃO RODOU: o copiador está rodando (ou a trava não abre); nada apagado, rode de novo em alguns minutos" >&2; return 1; }',
]

export function scriptDasPendencias(
  l: Extract<LeituraPendencias, { ok: true }>,
  o: { versao: string },
): { ok: true; linhas: string[]; resumo: string } | { ok: false; porque: string } {
  const itens: string[] = []
  let temApagar = false
  for (const i of l.itens) {
    switch (i.tempo) {
      case 'sem_comando': itens.push(`  echo ${aspas(`ESPERA-COMANDO ${i.itemId}: o comando chega com a etapa do expurgo (M9); nada a rodar agora`)}; esperando=$((esperando+1))`); break
      case 'conferir_b2': itens.push(`  echo ${aspas(`ESPERA-B2 ${i.itemId}: a forja confere o B2 sozinha; nada a rodar agora`)}; esperando=$((esperando+1))`); break
      case 'bloqueado': itens.push(`  echo ${aspas(`BLOQUEADO ${i.itemId}: apagar está indisponível agora (veja o aviso na página)`)}; esperando=$((esperando+1))`); break
      case 'apagar_antigas':
        temApagar = true
        for (const a of i.apagar) {
          itens.push(`  apaga_conferido ${aspas(a.filho)} ${aspas(a.caminho)} ${aspas(a.sha256)} ${aspas(a.nova?.caminho ?? '')} ${aspas(a.nova?.sha256 ?? '')}`)
        }
        for (const n of i.b2Nomes) itens.push(`  echo ${aspas(`B2-PAINEL: ${n}`)}`)
        break
      default:
        return { ok: false, porque: `tempo ${i.tempo}: este obs-arquivo ainda não gera esse passo (chega com a M9)` }
    }
  }
  const quando = dataBr(l.lidoEm)
  const fim = l.itens.length === 0
    ? `  echo ${aspas(`OBS-ARQUIVO: NADA PENDENTE (lido em ${quando})`)}`
    : temApagar
      ? '  echo "OBS-ARQUIVO: FEITO ($apagados apagado(s), $ja já apagado(s), $esperando esperando)"'
      : `  echo ${aspas(`OBS-ARQUIVO: NADA A RODAR AGORA (${l.itens.length} esperando)`)}`
  const linhas = [
    '#!/bin/bash',
    `# obs:arquivo pendencias, lido em ${l.lidoEm.toISOString()}, gerado por ${o.versao.replace(/[^A-Za-z0-9 ._-]/g, '?')}. Roda NA FORJA, pela linha da peça 7:`,
    "#   cd ~/Workspace/bythiagofigueiredo && npm run -s obs:arquivo | ssh forja 'bash -s'",
    '# Toda execução termina numa linha "OBS-ARQUIVO: ..."; sem ela, nada rodou.',
    '# O corpo é uma função chamada na MESMA linha do "}" que a fecha; se o script chegar cortado, o trap abaixo avisa e sai 1.',
    ...CORPO_ABRE,
    ...(temApagar ? FUNCAO : []),
    ...(temApagar ? TRAVA : []),
    ...itens,
    '  if [ "$falhas" -gt 0 ]; then echo "OBS-ARQUIVO: NÃO TERMINOU ($falhas conferência(s) falharam; nada delas foi apagado)" >&2; return 1; fi',
    fim,
    '}; obs_arquivo_main; exit $?',
  ]
  return { ok: true, linhas, resumo: `obs:arquivo: ${l.itens.length} pendência(s) lida(s) em ${quando}; o script vai para a forja` }
}
