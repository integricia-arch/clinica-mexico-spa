import { describe, it, expect } from 'vitest'
import { calcularPuntosPreview, valorCanjeMxn, nivelMultiplicador, NIVEL_LABEL } from '@/features/lealtad/types'
import type { LoyaltyConfig } from '@/features/lealtad/types'

const mockConfig: LoyaltyConfig = {
  clinic_id: 'test',
  nombre_programa: 'Test',
  slug_farmacia: 'test',
  color_primario: '#000',
  logo_url: null,
  pesos_por_punto: 10,
  valor_punto_mxn: 0.10,
  puntos_minimos_canje: 100,
  nivel_plata_umbral: 500,
  nivel_oro_umbral: 1500,
  nivel_diamante_umbral: 4000,
  multiplicador_plata: 1.10,
  multiplicador_oro: 1.25,
  multiplicador_diamante: 1.50,
  expiracion_dias_inactividad: 180,
  programa_activo: true,
  actualizado_at: '',
}

describe('nivelMultiplicador', () => {
  it('bronce = 1.0', () => expect(nivelMultiplicador('bronce', mockConfig)).toBe(1.0))
  it('plata = 1.10', () => expect(nivelMultiplicador('plata', mockConfig)).toBe(1.10))
  it('oro = 1.25', () => expect(nivelMultiplicador('oro', mockConfig)).toBe(1.25))
  it('diamante = 1.50', () => expect(nivelMultiplicador('diamante', mockConfig)).toBe(1.50))
})

describe('valorCanjeMxn', () => {
  it('100 puntos = $10 MXN', () => expect(valorCanjeMxn(100, 0.10)).toBe(10))
  it('453 puntos = $45.30 MXN', () => expect(valorCanjeMxn(453, 0.10)).toBe(45.3))
  it('0 puntos = $0', () => expect(valorCanjeMxn(0, 0.10)).toBe(0))
})

describe('calcularPuntosPreview — flujo completo', () => {
  it('cliente oro compra $200', () => {
    const mult = nivelMultiplicador('oro', mockConfig)
    const pts = calcularPuntosPreview(200, mockConfig.pesos_por_punto, mult)
    expect(pts).toBe(25) // floor(200/10 * 1.25) = floor(25) = 25
  })

  it('cliente diamante compra $300', () => {
    const mult = nivelMultiplicador('diamante', mockConfig)
    const pts = calcularPuntosPreview(300, mockConfig.pesos_por_punto, mult)
    expect(pts).toBe(45) // floor(300/10 * 1.50) = floor(45) = 45
  })
})

describe('NIVEL_LABEL', () => {
  it('tiene todos los niveles', () => {
    expect(NIVEL_LABEL.bronce).toBeDefined()
    expect(NIVEL_LABEL.plata).toBeDefined()
    expect(NIVEL_LABEL.oro).toBeDefined()
    expect(NIVEL_LABEL.diamante).toBeDefined()
  })
})
