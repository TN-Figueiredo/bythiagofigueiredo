import { redirect } from 'next/navigation'

// Rota CURTA de propósito: o middleware de auth grava `next` só com o pathname
// (create-auth-middleware.js:21,42,51-54), então um Click para
// /cms/settings?section=instagram perderia a seção depois do login.
// settings-connected.tsx:1244 lê `section`.
export const dynamic = 'force-dynamic'

export default function InstagramSettingsShortcut(): never {
  redirect('/cms/settings?section=instagram')
}
