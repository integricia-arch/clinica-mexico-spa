---
tags: [concepto, iva, fiscalidad, mexico]
---

# IVA en México — Cálculo en POS

## Regla fundamental
**Los precios en México YA incluyen IVA.** No se suma al total.

## Fórmula correcta
```
base_gravable = precio_con_iva / (1 + tasa)   # ej: 100 / 1.16 = 86.21
iva = precio_con_iva - base_gravable           # ej: 100 - 86.21 = 13.79
```

## Con descuento global
Cuando hay descuento global (aplicado al total), el IVA se calcula **proporcional** al descuento:
```typescript
const discountRatio = subtotal > 0 ? total / subtotal : 1;
// Para cada item:
const itemSub = (qty * unitPrice - itemDiscount) * discountRatio;
const base = itemSub / (1 + tasa);
const iva = itemSub - base;
```

## Tasas
- **16%** — mayoría de productos
- **0%** — alimentos básicos, medicamentos (algunos)
- **Exento** — diferente a tasa 0 (sin derecho a acreditamiento)

## En el ticket
Mostrar separado:
- Base gravable 16%
- IVA 16%
- Exento (si aplica)
- Total (incluye todo)

Implementado en: `src/features/farmacia/PuntoDeVenta.tsx` (`baseGravable`, `exento`, `totalIva`)
