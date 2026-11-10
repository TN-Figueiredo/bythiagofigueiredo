/**
 * Views/mvs de `public` que PODEM ficar legíveis por anon/authenticated sem security_invoker.
 * nome -> motivo. Começa vazia: toda entrada nova exige justificativa revisada.
 */
export const EXCECOES: Record<string, string> = {}

/**
 * Policies de escrita em storage.objects abertas a public/anon sem conferir papel que são de propósito.
 * nome da policy -> motivo. Começa vazia: toda entrada nova exige justificativa revisada.
 */
export const EXCECOES_STORAGE: Record<string, string> = {}
