import { RULES } from './rules'

// [PERGUNTA AO DONO] pergunta 10 do plano conjunto (.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/plano-conjunto.md):
// o teste nativo do YouTube divide ao mesmo tempo e não alterna por tempo; A -> B -> A em poucos dias é só o que se vê,
// sem atribuir ao YouTube. Este é o único ponto onde o texto mora. O campo interno `testCompare` mantém o nome.
export const ALTERNANCIA_DIAS = RULES.testCompareMaxDays
export const ALTERNANCIA_ROTULO = `Alternância de miniatura (A → B → A em até ${ALTERNANCIA_DIAS} dias)`
export const ALTERNANCIA_RESSALVA = 'Não dá para saber a causa: o YouTube não informa se houve teste.'
