// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { DetailHeader } from '@/app/cms/(authed)/youtube/ab-lab/_components/detail-header'
import type { AbTestStatus, TestType } from '@/lib/youtube/ab-types'

afterEach(cleanup)
const abre = () => fireEvent.click(screen.getByRole('button', { name: 'O que é este teste' }))
const monta = (flag: TestType, status: AbTestStatus = 'active', lab: { thumbUrl: string | null; naoIniciado?: boolean; concluidoEm?: string } = { thumbUrl: null }) =>
  render(<DetailHeader title="V" flag={flag} status={status} roundNumber={1} totalRounds={1} hasPlayoff={false} dayInfo={{ dayOf: 2, total: 15 }} lab={lab} />)

describe('página do teste: origem do Lab (M7 T18)', () => {
  it('título: diz que o Lab troca o título em rodízio e que não é o do Studio', () => {
    monta('title')
    abre()
    expect(screen.getByText('Teste do A/B Lab: o Lab troca o título público do vídeo no YouTube em rodízio, uma versão por vez. Não é o “Testar e comparar” do Studio.')).toBeTruthy()
  })
  it('miniatura e combo trocam o alvo', () => {
    monta('thumbnail')
    abre()
    expect(screen.getByText(/o Lab troca a miniatura pública/)).toBeTruthy()
    cleanup()
    monta('combo', 'paused')
    abre()
    expect(screen.getByText(/o Lab troca o título e a miniatura públicos/)).toBeTruthy()
  })
  it('concluído ou não iniciado: sem a frase', () => {
    monta('title', 'completed', { thumbUrl: null, concluidoEm: '10/10' })
    expect(screen.queryByRole('button', { name: 'O que é este teste' })).toBeNull()
  })
  it('não iniciado: sem a frase (M5b)', () => {
    monta('title', 'active', { thumbUrl: null, naoIniciado: true })
    expect(screen.queryByRole('button', { name: 'O que é este teste' })).toBeNull()
  })
})
