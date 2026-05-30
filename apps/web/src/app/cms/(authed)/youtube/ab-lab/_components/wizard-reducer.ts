// Re-export from canonical location in lib/youtube/
// Kept for backwards compatibility with any in-tree imports.
export {
  wizardReducer,
  stepIsValid,
  makeOriginalVariant,
  makeEmptyVariant,
} from '@/lib/youtube/ab-wizard-reducer'

export type {
  WizardState,
  WizardAction,
  VariantData,
} from '@/lib/youtube/ab-wizard-reducer'
