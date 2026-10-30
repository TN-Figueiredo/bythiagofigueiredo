/**
 * Peça 7 (M3b-forja, Tarefa 7a, D-F24/D-F25): o script `bash` que o Mac imprime e o `ssh forja 'bash -s'` roda na forja.
 * Puro. Todo valor do banco entra entre aspas simples; toda saída termina numa linha `OBS-ARQUIVO: ...`.
 */
import { fraseSnapEspera, type Falta, type Motivo, type LeituraPendencias } from '../arquivo-mensal/pendencias'
import type { Filho } from '../arquivo-mensal/contrato'

/** O que o Mac já registrou nesta execução (M9, Tarefa 8): o arquivo da versão nova, em base64, para o script gravar em `_recebendo`. */
export interface CopiaPreparada { itemId: string; filho: Filho; caminho: string; sha256: string; base64: string }

export const FRASE_DA_FALTA: Record<Falta, string> = {
  unidade_no_nas: 'a unidade ainda não está no NAS; a cópia vem pelo ciclo normal',
  resumo: 'falta o resumo do mês; a forja o refaz no ciclo normal',
  manifesto: 'falta o manifesto do mês; a forja o refaz no ciclo normal',
  b2_nova: 'a versão nova ainda não chegou ao B2; a sincronização a envia',
  versao_em_curso: 'há uma versão nova em curso; espere ela terminar',
  segunda_conferencia: 'falta a segunda conferência de ausência no NAS; ela roda sozinha',
  snapshots: 'os snapshots do NAS de antes da remoção ainda não expiraram (14 dias); a limpeza segue sozinha',
  conferencia_nas_recente: 'a última conferência no NAS é recente demais; espere a próxima',
  b2_sync: 'o B2 ainda não sincronizou a remoção; ele roda sozinho',
  blobs: 'ainda há blobs (anexos) do canal a tratar; eles saem pelo ciclo normal',
  imagens: 'faltam as miniaturas do canal ou o aceite do dono sobre as ausentes (veja a página do Arquivo)',
  lote_e10: 'há um lote da E10 aberto para este canal; feche-o antes',
  so_prefixo: 'só restam pastas (prefixos) sem arquivo conhecido; a limpeza as confere sozinha',
  m9_desligado: 'a limpeza está desligada; o dono liga pelo painel (runbook)',
}
export const FRASE_DO_MOTIVO: Record<Motivo, string> = {
  antiga_ausente: 'a versão antiga já não está no NAS; confira o registro (veja a página do Arquivo)',
  antiga_divergente: 'a versão antiga no NAS não é a registrada; nada será apagado até o dono conferir',
  depende_m10b: 'este apagamento depende da etapa M10b, que ainda não chegou',
  grande_demais: 'o conjunto a apagar é grande demais para uma rodada; o dono decide (runbook)',
  contagem_divergente: 'a contagem de arquivos não bate com o registro; nada será apagado até o dono conferir',
}

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

const TRAP =
  'trap \'[ -n "${OBS_CHAMADO:-}" ] || { echo "OBS-ARQUIVO: NÃO RODOU: o script chegou incompleto; nada feito" >&2; exit 1; }\' EXIT'
const CORPO_ABRE = [
  'obs_arquivo_main() {',
  '  OBS_CHAMADO=1',
  '  set -u',
  '  if [ "$(hostname -s)" != forja ]; then echo "OBS-ARQUIVO: NÃO RODOU: este script roda na forja (ssh forja \'bash -s\'); nada feito aqui" >&2; return 3; fi',
  '  local M="${ARQ_MONTAGEM_ESCRITA:-/mnt/arquivo/escrita}" falhas=0 apagados=0 gravados=0 ja=0 esperando=0',
]
const FUNCAO = [
  '  apaga_conferido() {   # filho caminho sha256 nova_caminho nova_sha256 (os dois últimos vazios = sem versão nova a exigir)',
  '    local base="$M/$1" alvo="$M/$1/$2"',
  '    if ! mountpoint -q "$base" || [ ! -f "$base/.arquivo-vivo" ]; then echo "PULADO $1/$2: o NAS não está montado ou sem a sentinela" >&2; falhas=$((falhas+1)); return 0; fi',
  '    if [ -n "$4" ] && [ "$alvo" -ef "$base/$4" ]; then echo "PULADO $1/$2: a antiga e a nova são o mesmo arquivo" >&2; falhas=$((falhas+1)); return 0; fi',
  '    if [ -n "$4" ] && { [ ! -f "$base/$4" ] || [ "$(sha256sum < "$base/$4" | cut -c1-64)" != "$5" ]; }; then echo "PULADO $1/$2: a versão nova não está no NAS como o site registrou" >&2; falhas=$((falhas+1)); return 0; fi',
  '    if [ ! -e "$alvo" ]; then if [ -d "$(dirname "$alvo")" ]; then echo "JA-APAGADO $1/$2"; ja=$((ja+1)); else echo "PULADO $1/$2: a pasta não existe (caminho errado no site?)" >&2; falhas=$((falhas+1)); fi; return 0; fi',
  '    if [ "$(sha256sum < "$alvo" | cut -c1-64)" != "$3" ]; then echo "PULADO $1/$2: o arquivo no NAS não é o que o site registrou" >&2; falhas=$((falhas+1)); return 0; fi',
  '    if rm -- "$alvo"; then echo "APAGADO $1/$2"; apagados=$((apagados+1)); elif [ ! -e "$alvo" ]; then echo "JA-APAGADO $1/$2"; ja=$((ja+1)); else echo "PULADO $1/$2: o rm falhou" >&2; falhas=$((falhas+1)); fi',
  '  }',
]
const GRAVA = [
  '  grava_recebendo() {   # filho caminho sha256; o conteúdo chega em base64 pela entrada, até a linha OBS-B64',
  '    local base="$M/$1" final="$M/$1/$2" dest="$M/$1/_recebendo/$2" tmp',
  '    if ! mountpoint -q "$base" || [ ! -f "$base/.arquivo-vivo" ]; then cat > /dev/null; echo "PULADO $1/$2: o NAS não está montado ou sem a sentinela" >&2; falhas=$((falhas+1)); return 0; fi',
  '    if [ -f "$final" ] && [ "$(sha256sum < "$final" | cut -c1-64)" = "$3" ]; then cat > /dev/null; echo "JA-GRAVADO $1/$2"; ja=$((ja+1)); return 0; fi',
  '    if [ -f "$dest" ] && [ "$(sha256sum < "$dest" | cut -c1-64)" = "$3" ]; then cat > /dev/null; echo "JA-GRAVADO $1/_recebendo/$2"; ja=$((ja+1)); return 0; fi',
  '    mkdir -p -- "$(dirname -- "$dest")" "$base/.m9-tmp"; tmp="$base/.m9-tmp/$(basename -- "$2").$$"   # fora de _recebendo: o copiador não vê arquivo pela metade',
  '    if ! base64 -d > "$tmp" || [ "$(sha256sum < "$tmp" | cut -c1-64)" != "$3" ]; then rm -f -- "$tmp"; echo "PULADO $1/$2: o arquivo chegou diferente do registrado" >&2; falhas=$((falhas+1)); return 0; fi',
  '    if mv -n -- "$tmp" "$dest" && [ ! -e "$tmp" ]; then echo "GRAVADO $1/_recebendo/$2"; gravados=$((gravados+1)); else rm -f -- "$tmp"; echo "PULADO $1/$2: já havia outro arquivo em _recebendo com esse nome" >&2; falhas=$((falhas+1)); fi',
  '  }',
]
const PREFIXO = [
  '  limpa_prefixo() {   # prefixo (relativo à raiz do filho); tenta os dois filhos, cada um só com montagem e sentinela',
  '    local f d',
  '    for f in numerico texto; do',
  '      d="$M/$f/$1"',
  '      if ! mountpoint -q "$M/$f" || [ ! -f "$M/$f/.arquivo-vivo" ]; then continue; fi',
  '      [ -d "$d" ] || continue',
  '      find "$d" -xdev -depth -type d -empty -delete',
  '      if [ -d "$d" ]; then echo "RESTA $1: há arquivo que o site não conhece; use \\"Ver os comandos\\" na página do Arquivo"; esperando=$((esperando+1)); fi',
  '    done',
  '  }',
  '  b2_painel() {         # o nome vem do site, já validado pelo leitor (NOME_B2); a forja não traduz nada',
  '    echo "B2-PAINEL: $1"',
  '  }',
]
const TRAVA = [
  '  T="${ARQ_TRAVA_COPIADOR:-/opt/arquivo/copiador.lock}"',
  '  [ -r "$T" ] && exec 9<"$T" && flock -n 9 || { echo "OBS-ARQUIVO: NÃO RODOU: o copiador está rodando (ou a trava não abre); nada apagado, rode de novo em alguns minutos" >&2; return 1; }',
]

export function scriptDasPendencias(
  l: Extract<LeituraPendencias, { ok: true }>,
  o: { versao: string; copias?: readonly CopiaPreparada[] },
): { ok: true; linhas: string[]; resumo: string } | { ok: false; porque: string } {
  const itens: string[] = []
  let temApagar = false, temGrava = false, temPrefixo = false
  const esp = (frase: string): string => `  echo ${aspas(frase)}; esperando=$((esperando+1))`
  const tamanho = (b64: string): string[] => b64.replace(/\s+/g, '').match(/.{1,76}/g) ?? []
  for (const i of l.itens) {
    switch (i.tempo) {
      case 'sem_comando': {
        let frase = i.falta ? FRASE_DA_FALTA[i.falta] : 'o comando ainda não está liberado'
        if (i.falta === 'snapshots') {
          const ms = i.snapLiberaEm?.getTime() ?? 0, agora = l.lidoEm.getTime()
          frase = fraseSnapEspera({ bloqueio: i.snapBloqueio, esperaDesde: i.snapEsperaDesde, liberaEm: i.snapLiberaEm, passou: !!i.snapLiberaEm && ms <= agora, atrasada: !!i.snapLiberaEm && ms < agora - 86_400_000 }, d => dataBr(d).slice(0, 5)).texto
        }
        // M9, Tarefa 8: o Mac já registrou a cópia (ou a reemite): o item saiu de `copiar` mas o arquivo ainda precisa chegar a `_recebendo`
        const registradas = (o.copias ?? []).filter(c => c.itemId === i.itemId)
        if (registradas.length > 0) {
          temGrava = true
          for (const c of registradas) itens.push(`  grava_recebendo ${aspas(c.filho)} ${aspas(c.caminho)} ${aspas(c.sha256)} <<'OBS-B64'`, ...tamanho(c.base64), 'OBS-B64')
        }
        itens.push(esp(`ESPERA ${i.itemId}: ${frase}`)); break
      }
      case 'bloqueado': itens.push(esp(`BLOQUEADO ${i.itemId}: ${i.motivo ? FRASE_DO_MOTIVO[i.motivo] : 'apagar está indisponível agora (veja o aviso na página)'}`)); break
      case 'copiar': {
        const minhas = (o.copias ?? []).filter(c => c.itemId === i.itemId)
        if (minhas.length === 0) { itens.push(esp(`ESPERA-COPIA ${i.itemId}: o Mac não preparou a cópia (veja a mensagem dele acima)`)); break }
        temGrava = true
        for (const c of minhas) itens.push(`  grava_recebendo ${aspas(c.filho)} ${aspas(c.caminho)} ${aspas(c.sha256)} <<'OBS-B64'`, ...tamanho(c.base64), 'OBS-B64')
        break
      }
      case 'conferir_b2':
        temPrefixo = true
        for (const n of i.b2Nomes) itens.push(`  b2_painel ${aspas(n)}`)
        itens.push(`  echo ${aspas('no painel do B2: Buckets > <bucket> > Browse Files, com "mostrar versões" ligado, procure o nome')}`)
        break
      case 'apagar_antigas':
        temApagar = true
        for (const a of i.apagar) {
          itens.push(`  apaga_conferido ${aspas(a.filho)} ${aspas(a.caminho)} ${aspas(a.sha256)} ${aspas(a.nova?.caminho ?? '')} ${aspas(a.nova?.sha256 ?? '')}`)
        }
        if (i.itemId.startsWith('canal:')) { temPrefixo = true; for (const p of i.prefixos) itens.push(`  limpa_prefixo ${aspas(p)}`) }
        break
    }
  }
  const quando = dataBr(l.lidoEm)
  const fim = l.itens.length === 0
    ? `  echo ${aspas(`OBS-ARQUIVO: NADA PENDENTE (lido em ${quando})`)}`
    : temApagar || temGrava
      ? '  echo "OBS-ARQUIVO: FEITO ($gravados gravado(s), $apagados apagado(s), $ja já feito(s), $esperando esperando)"'
      : `  echo ${aspas(`OBS-ARQUIVO: NADA A RODAR AGORA (${l.itens.length} esperando)`)}`
  const linhas = [
    '#!/bin/bash',
    TRAP,   // logo depois do shebang: a janela em que um corte sai 0 calado fica em ~12 bytes (Phil M2, Yannis M1)
    `# obs:arquivo pendencias, lido em ${l.lidoEm.toISOString()}, gerado por ${o.versao.replace(/[^A-Za-z0-9 ._-]/g, '?')}. Roda NA FORJA, pela linha da peça 7:`,
    "#   cd ~/Workspace/bythiagofigueiredo && npm run -s obs:arquivo | ssh forja 'bash -s'",
    '# Toda execução termina numa linha "OBS-ARQUIVO: ..."; sem ela, nada rodou.',
    '# O corpo é uma função chamada na MESMA linha do "}" que a fecha; se o script chegar cortado, o trap da linha 2 avisa e sai 1.',
    ...CORPO_ABRE,
    ...(temApagar ? FUNCAO : []),
    ...(temGrava ? GRAVA : []),
    ...(temApagar || temPrefixo ? PREFIXO : []),
    ...(temApagar || temGrava ? TRAVA : []),
    ...itens,
    '  if [ "$falhas" -gt 0 ]; then echo "OBS-ARQUIVO: NÃO TERMINOU ($falhas conferência(s) falharam; nada delas foi apagado)" >&2; return 1; fi',
    fim,
    '}; obs_arquivo_main; exit $?',
  ]
  return { ok: true, linhas, resumo: `obs:arquivo: ${l.itens.length} pendência(s) lida(s) em ${quando}; o script vai para a forja` }
}
