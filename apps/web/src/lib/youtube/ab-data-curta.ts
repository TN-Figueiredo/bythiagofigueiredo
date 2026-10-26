/** Datas curtas no fuso de São Paulo (fonte única; o núcleo puro não importa de `app/`). */

/** "07/10 05:00" no fuso de São Paulo; vazio quando a data falta ou é inválida. */
export function dataCurtaSp(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const g = (t: string) => p.find(x => x.type === t)?.value ?? ''
  return `${g('day')}/${g('month')} ${g('hour')}:${g('minute')}`
}

/** "07/10" no fuso de São Paulo; vazio quando a data falta ou é inválida. */
export function diaMesSp(iso: string | null | undefined): string {
  return dataCurtaSp(iso).slice(0, 5)
}
