import type { SocialStrings } from './types'
import { en } from './en'
import { ptBR } from './pt-BR'

export type { SocialStrings }

export function getSocialStrings(locale: 'en' | 'pt-BR'): SocialStrings {
  return locale === 'pt-BR' ? ptBR : en
}
