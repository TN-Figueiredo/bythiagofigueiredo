import * as Sentry from '@sentry/nextjs'

/** Phil I5 (M5 r1): função do arquivo ausente com o arquivo LIGADO (OBS_ARQUIVO=on) não pode sumir em silêncio (a aba desaparece, a pastilha também).
 *  Sem a variável o arquivo está desligado de propósito e não há o que avisar. O cache de 60 s ou mais das leituras limita o aviso a poucos por hora. */
export function avisarFuncaoAusente(funcao: string): void {
  if (process.env.OBS_ARQUIVO === 'on') Sentry.captureMessage(`${funcao} ausente com OBS_ARQUIVO=on`, 'warning')
}
