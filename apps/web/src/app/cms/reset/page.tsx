import { hasRecoverySession } from '@/lib/auth/has-recovery-session'
import { ResetForm } from './reset-form'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const canReset = await hasRecoverySession()
  return <ResetForm canReset={canReset} />
}
