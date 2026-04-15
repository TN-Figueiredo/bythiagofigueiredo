import { createAdminLayout } from '@tn-figueiredo/admin'
import { createServerClient, requireUser } from '@tn-figueiredo/auth-nextjs'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

const CmsLayout = createAdminLayout({
  appName: 'CMS',
  sections: [
    {
      group: 'Content',
      items: [
        { label: 'Blog posts', path: '/cms/blog', icon: 'Pencil' },
        { label: 'Authors', path: '/cms/authors', icon: 'User' },
      ],
    },
    {
      group: 'Campaigns',
      items: [
        { label: 'Landing pages', path: '/cms/campaigns', icon: 'Target' },
        { label: 'Submissions', path: '/cms/submissions', icon: 'Inbox' },
      ],
    },
    {
      group: 'Contatos',
      items: [
        { label: 'Contatos recebidos', path: '/cms/contacts', icon: 'Mail' },
      ],
    },
  ],
})

export default async function Layout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const user = await requireUser(
    createServerClient({
      env: {
        apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, options)
          }
        },
      },
    }),
  )
  return <CmsLayout userEmail={user.email ?? ''}>{children}</CmsLayout>
}
