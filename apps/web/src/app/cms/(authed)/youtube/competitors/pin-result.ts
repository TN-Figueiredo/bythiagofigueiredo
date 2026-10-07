/**
 * Result of pinVideo / unpinVideo. `error` is the FINAL sentence, shown as it is: never a code and never a database
 * message. `kind` only tells the screen which treatment to use (the cap opens the limit refusal).
 */
export type PinResult = { ok: true } | { ok: false; kind: 'cap' | 'failed' | 'denied'; error: string }
