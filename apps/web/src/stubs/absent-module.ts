// Turbopack resolveAlias target for `resend` / `svix` / `nodemailer`.
//
// `@tn-figueiredo/email@0.2.0` statically imports these three adapters
// (Resend, Svix webhook verification, SMTP via nodemailer) from its dist
// chunks even though the app only ever uses the SES adapter — the project
// migrated to AWS SES and none of these modules are installed (nor should
// they be; they're dead code paths in the published package). Webpack
// tolerated the unresolved static import because nothing reachable at
// runtime called into it; Turbopack refuses to build with an unresolvable
// module, so every import of these three names is aliased here instead.
//
// If any live code path is ever changed to actually construct one of these
// adapters, accessing it will throw loudly instead of silently doing
// nothing — surfacing the mistake immediately rather than failing deep
// inside a third-party SDK.
//
// Durable fix belongs upstream in @tn-figueiredo/email: make these adapters
// optional/lazy-imported deps (tracked as a WP-6 finding).

// The Proxy target MUST be a function: `new Resend(key)` and
// `new Webhook(secret)` are direct `[[Construct]]` calls on the imported
// binding (not a property access first), and a Proxy only gets a
// `[[Construct]]`/`[[Call]]` internal method when its target already has
// one — a plain `{}` target would make `new Resend(...)` throw a generic
// "not a constructor" TypeError from the engine instead of our message.
function makeAbsentModuleProxy(moduleName: string): unknown {
  const throwAbsent = (): never => {
    throw new Error(
      `módulo ${moduleName} não está instalado — adapter morto do @tn-figueiredo/email`,
    )
  }

  return new Proxy(function AbsentModule() {}, {
    get: throwAbsent,
    apply: throwAbsent,
    construct: throwAbsent,
  })
}

export const Resend = makeAbsentModuleProxy('resend')
export const Webhook = makeAbsentModuleProxy('svix')

export default makeAbsentModuleProxy('nodemailer')
