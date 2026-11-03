// Next procura o hook em `join(appDir, '..')`: com o app em `src/app`, só `src/instrumentation.ts`
// é declarado para a função Node da Vercel (o arquivo na raiz do app compilava, mas não era empacotado).
// Os configs do Sentry ficam na raiz do app, por isso o `../`.
//
// `register()` nunca pode lançar: o Next guarda a promessa rejeitada e relança em todo boot de rota.

export async function register() {
  try {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('../sentry.server.config')
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('../sentry.edge.config')
    }
  } catch (err) {
    // telemetria nunca derruba a função
    console.error('[sentry] register falhou', err)
  }
}

// Next 15+ procura `onRequestError` neste módulo; o Sentry traz `captureRequestError` com a assinatura exata.
export { captureRequestError as onRequestError } from '@sentry/nextjs'
