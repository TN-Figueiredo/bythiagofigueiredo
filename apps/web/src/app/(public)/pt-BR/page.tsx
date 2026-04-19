import type { Metadata } from 'next'
import { PinboardHome } from '../components/PinboardHome'

export const metadata: Metadata = {
  title: 'Thiago Figueiredo — Criador & Builder',
  description: 'Textos, vídeos e experimentos da beira do teclado.',
  alternates: {
    canonical: 'https://bythiagofigueiredo.com/pt-BR',
    languages: { en: 'https://bythiagofigueiredo.com' },
  },
}

export default function HomePagePtBR() {
  return <PinboardHome locale="pt-BR" />
}
