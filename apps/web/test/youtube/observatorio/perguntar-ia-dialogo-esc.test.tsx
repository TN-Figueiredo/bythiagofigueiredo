// @vitest-environment jsdom
/**
 * G-6/G-7 (Gio, 15/10; portão Yannis 17/10, I1): prova que roda sem o interruptor `ligado` real. Com o ⓘ aberto, o Esc fecha só o ⓘ
 * (o keydown é cancelado, então o <dialog> nem recebe o pedido de fechamento); segundo clique no ⓘ fecha; três ciclos seguidos.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { Dialogo } from '@/app/cms/(authed)/youtube/competitors/_chrome/perguntar-ia/dialogo'
import { CONTEXTO, modeloCheio } from './contexto-ia-fixture'

const pacote = segmentar(modeloCheio(), CONTEXTO)

function montar(onFechar = vi.fn()) {
  const abridor = { current: document.createElement('button') }
  render(
    <Dialogo nomeDaTela="Comparar" exemplos={['a?']} estado={{ fase: 'pronto', pacote }} copia="ocioso" pergunta="" onPergunta={() => {}}
      onCopiar={() => {}} onFechar={onFechar} onTentarDeNovo={() => {}} abridor={abridor} />,
  )
  return { onFechar, d: document.querySelector('dialog') as HTMLDialogElement, ibtn: () => document.querySelector('[data-info="metodo"]') as HTMLElement }
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
})
afterEach(() => cleanup())

describe('Dialogo: Esc e o ⓘ (G-6)', () => {
  it('Esc com o ⓘ aberto fecha só o ⓘ, cancela o keydown e não pede o fechamento; 3 ciclos', async () => {
    const { onFechar, d, ibtn } = montar()
    for (let i = 0; i < 3; i++) {
      await act(async () => { fireEvent.click(ibtn()) })
      expect(document.getElementById('pi-i-metodo')).not.toBeNull()
      let livre = true
      await act(async () => { livre = fireEvent.keyDown(d, { key: 'Escape' }) })
      expect(livre, 'keydown cancelado').toBe(false)
      expect(document.getElementById('pi-i-metodo')).toBeNull()
      expect(onFechar).not.toHaveBeenCalled()
      expect(d.hasAttribute('open')).toBe(true)
    }
  })
  it('Esc sem ⓘ aberto não é cancelado no keydown', async () => {
    const { d } = montar()
    let livre = false
    await act(async () => { livre = fireEvent.keyDown(d, { key: 'Escape' }) })
    expect(livre).toBe(true)
  })
  it('segundo clique no ⓘ fecha o painel', async () => {
    const { ibtn } = montar()
    await act(async () => { fireEvent.click(ibtn()) })
    expect(document.getElementById('pi-i-metodo')).not.toBeNull()
    await act(async () => { fireEvent.click(ibtn()) })
    expect(document.getElementById('pi-i-metodo')).toBeNull()
  })
})
