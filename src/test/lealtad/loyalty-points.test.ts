import { describe, it, expect } from 'vitest'
import {
  calcularPuntosPreview,
  valorCanjeMxn,
  nivelMultiplicador,
} from '@/features/lealtad/types'
import type { LoyaltyConfig } from '@/features/lealtad/types'

const mockConfig: LoyaltyConfig = {
  clinic_id: 'test-clinic',
  nombre_programa: 'Test',
  slug_farmacia: 'test',
  color_primario: '#000',
  logo_url: null,
  pesos_por_punto: 10,
  valor_punto_mxn: 0.5,
  puntos_minimos_canje: 100,
  nivel_plata_umbral: 500,
  nivel_oro_umbral: 1000,
  nivel_diamante_umbral: 2000,
  multiplicador_plata: 1.1,
  multiplicador_oro: 1.25,
  multiplicador_diamante: 1.5,
  expiracion_dias_inactividad: 365,
  programa_activo: true,
  actualizado_at: '2024-01-01T00:00:00Z',
}

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

  it('retorna 0 si pesosPorPunto es 0', () => {
    expect(calcularPuntosPreview(100, 0, 1.0)).toBe(0)
  })
})

describe('valorCanjeMxn', () => {
  it('calcula valor en MXN', () => {
    expect(valorCanjeMxn(100, 0.5)).toBe(50)
  })

  it('retorna 0 si puntos es 0', () => {
    expect(valorCanjeMxn(0, 0.5)).toBe(0)
  })

  it('redondea a 2 decimales', () => {
    expect(valorCanjeMxn(3, 0.333)).toBe(1)
  })
})

describe('nivelMultiplicador', () => {
  it('retorna 1.0 para bronce', () => {
    expect(nivelMultiplicador('bronce', mockConfig)).toBe(1.0)
  })

  it('retorna multiplicador_plata para plata', () => {
    expect(nivelMultiplicador('plata', mockConfig)).toBe(1.1)
  })

  it('retorna multiplicador_oro para oro', () => {
    expect(nivelMultiplicador('oro', mockConfig)).toBe(1.25)
  })

  it('retorna multiplicador_diamante para diamante', () => {
    expect(nivelMultiplicador('diamante', mockConfig)).toBe(1.5)
  })
})
