// TODO: [APP_NAME] Configure admin layout with @tn-figueiredo/admin
// import { createAdminLayout } from '@tn-figueiredo/admin'
// import type { AdminLayoutConfig } from '@tn-figueiredo/admin'
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
