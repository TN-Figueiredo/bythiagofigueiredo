import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
  drawer: ReactNode
}

export default function SocialLayout({ children, drawer }: LayoutProps) {
  return (
    <>
      {children}
      {drawer}
    </>
  )
}
