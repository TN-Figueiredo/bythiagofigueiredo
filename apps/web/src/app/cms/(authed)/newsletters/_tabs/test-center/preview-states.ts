export const CONFIRM_PREVIEW_STATES = ['success', 'already', 'expired', 'not_found', 'error', 'invalid', 'loading', 'error-boundary'] as const
export const UNSUBSCRIBE_PREVIEW_STATES = ['initial', 'ok', 'already', 'not_found', 'error', 'invalid', 'loading', 'error-boundary'] as const

export type ConfirmPreviewState = (typeof CONFIRM_PREVIEW_STATES)[number]
export type UnsubscribePreviewState = (typeof UNSUBSCRIBE_PREVIEW_STATES)[number]
