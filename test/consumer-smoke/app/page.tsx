import { BrevoEmailAdapter } from '@tn-figueiredo/email'

export default function Page() {
  const ctor = BrevoEmailAdapter
  return <main>Smoke: {ctor ? 'ok' : 'fail'}</main>
}
