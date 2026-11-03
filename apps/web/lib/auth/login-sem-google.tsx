import type { ReactNode } from 'react'
import './login-sem-google.css'

/** Envolve CmsLogin/AdminLogin; ver a regra em login-sem-google.css. */
export function LoginSemGoogle({ children }: { children: ReactNode }) {
  return <div className="login-sem-google">{children}</div>
}
