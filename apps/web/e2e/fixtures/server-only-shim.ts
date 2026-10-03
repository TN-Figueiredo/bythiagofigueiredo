/**
 * Lets a Playwright spec import server modules (`import 'server-only'`) directly, e.g. the observatório loader in
 * seed.spec.ts. `server-only` is not a dependency of the app: Next resolves it to its own compiled copy, and Vitest
 * aliases it to test/__stubs__/server-only.ts. Here it resolves to Next's empty build of the package (the one Next
 * itself uses under the react-server condition). Import this module BEFORE the server module.
 */
import Module from 'node:module'

type Resolve = (request: string, ...rest: unknown[]) => string
const M = Module as unknown as { _resolveFilename: Resolve }
// private Node API: fail with a clear message rather than a confusing resolve error if a Node release changes it
if (typeof M._resolveFilename !== 'function') throw new Error('server-only-shim: Module._resolveFilename is gone in this Node version; update the shim')
const original = M._resolveFilename
const EMPTY = require.resolve('next/dist/compiled/server-only/empty')
M._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]): string {
  return request === 'server-only' ? EMPTY : original.call(this, request, ...rest)
}
