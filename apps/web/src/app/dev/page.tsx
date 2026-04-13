import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Hero } from '@/components/sections/hero'
import { About } from '@/components/sections/about'
import { Experience } from '@/components/sections/experience'
import { Projects } from '@/components/sections/projects'
import { Testimonials } from '@/components/sections/testimonials'
import { Contact } from '@/components/sections/contact'

export const metadata: Metadata = {
  title: 'Thiago Figueiredo | Builder & Founder',
  description:
    'Portfolio dev de Thiago Figueiredo. Founder da Figueiredo Technology. Mais de 12 anos construindo produtos digitais com React, TypeScript e Node.js.',
  alternates: {
    canonical: 'https://dev.bythiagofigueiredo.com',
  },
}

export default function DevPortfolio() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Experience />
        <Projects />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
