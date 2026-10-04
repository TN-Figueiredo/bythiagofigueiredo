/**
 * O que é uma campanha nova e válida, fonte única para o formulário do CMS
 * (`src/app/cms/(authed)/campaigns/new/actions.ts`) e para a graduação de item do pipeline.
 *
 * Os textos de sucesso ficam vazios na criação, como o CMS sempre fez: o editor da campanha os
 * preenche depois, e uma campanha em rascunho não os exibe. O vocabulário de `interest` vive em
 * `./interest` (espelha o CHECK `campaigns_interest_vocab`).
 */
export const CAMPAIGN_TRANSLATION_LOCALES = ['pt-BR', 'en'] as const
export type CampaignTranslationLocale = (typeof CAMPAIGN_TRANSLATION_LOCALES)[number]

/** Colunas NOT NULL de `campaign_translations` sem default no banco que o CMS cria vazias. */
export const NEW_CAMPAIGN_EMPTY_TRANSLATION_TEXTS = {
  success_headline: '',
  success_headline_duplicate: '',
  success_subheadline: '',
  success_subheadline_duplicate: '',
  check_mail_text: '',
  download_button_label: '',
} as const
