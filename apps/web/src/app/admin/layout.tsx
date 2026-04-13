// TODO: [APP_NAME] Configure admin layout with @figueiredo-technology/admin
// import { createAdminLayout } from '@figueiredo-technology/admin'
// import type { AdminLayoutConfig } from '@figueiredo-technology/admin'
//
// const config: AdminLayoutConfig = {
//   sidebar: [
//     { label: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
//     // TODO: [APP_NAME] Add sidebar items
//   ],
// }
// export default createAdminLayout(config)

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
