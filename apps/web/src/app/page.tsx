import { HubHeader } from '@/components/hub/hub-header'
import { HubHero } from '@/components/hub/hub-hero'
import { HubLinks } from '@/components/hub/hub-links'
import { HubNewsletter } from '@/components/hub/hub-newsletter'
import { HubSocials } from '@/components/hub/hub-socials'
import { HubFooter } from '@/components/hub/hub-footer'

export default function Home() {
  return (
    <>
      <HubHeader />
      <main>
        <HubHero />
        <HubLinks />
        <HubNewsletter />
        <HubSocials />
      </main>
      <HubFooter />
    </>
  )
}
