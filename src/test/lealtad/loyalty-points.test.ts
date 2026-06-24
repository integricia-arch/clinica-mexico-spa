import { describe, it, expect } from 'vitest'
import { calcularPuntosPreview } from '@/features/lealtad/types'

describe('calcularPuntosPreview', () => {
  it('calcula puntos con config base', () => {
    const result = calcularPuntosPreview(150.00, 10.00, 1.0)
    expect(result).toBe(15) // $150 / $10 por punto * 1.0 = 15
  })

  it('aplica multiplicador nivel plata', () => {
    const result = calcularPuntosPreview(100.00, 10.00, 1.10)
    expect(result).toBe(11) // floor(10 * 1.10) = 11
  })

  it('trunca hacia abajo', () => {
    const result = calcularPuntosPreview(95.00, 10.00, 1.0)
    expect(result).toBe(9) // floor(9.5) = 9
  })

  it('retorna 0 si monto menor que pesos_por_punto', () => {
    const result = calcularPuntosPreview(5.00, 10.00, 1.0)
    expect(result).toBe(0)
  })
})
