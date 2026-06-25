import { describe, it, expect } from 'vitest'

// Lógica extraída de PuntoDeVenta.tsx para testear en aislamiento
function calcTotalConLealtad(total: number, loyaltyDescuento: number): number {
  return Math.max(0, total - loyaltyDescuento)
}

describe('calcTotalConLealtad', () => {
  it('sin descuento lealtad — total sin cambio', () => {
    expect(calcTotalConLealtad(200, 0)).toBe(200)
  })

  it('descuento parcial — resta del total', () => {
    expect(calcTotalConLealtad(200, 50)).toBe(150)
  })

  it('descuento igual al total — resultado 0', () => {
    expect(calcTotalConLealtad(100, 100)).toBe(0)
  })

  it('descuento mayor al total — resultado clampado a 0', () => {
    expect(calcTotalConLealtad(80, 100)).toBe(0)
  })

  it('total con centavos — resultado preciso', () => {
    expect(calcTotalConLealtad(199.99, 45.30)).toBeCloseTo(154.69, 2)
  })

  it('total 0 con cualquier descuento — sigue siendo 0', () => {
    expect(calcTotalConLealtad(0, 50)).toBe(0)
  })
})
