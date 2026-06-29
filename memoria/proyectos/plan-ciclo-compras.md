
---
## PRÓXIMA SESIÓN — Implementar Fase 1 + Fase 5

### Fase 1 — Trazabilidad BD (migración SQL)
- `solicitudes_compra`: añadir FK `orden_id UUID REFERENCES ordenes_compra(id)`
- `ordenes_compra`: añadir FK `cotizacion_id UUID REFERENCES cotizaciones(id)`  
- `facturas_proveedor`: añadir FK `solicitud_id UUID REFERENCES solicitudes_compra(id)`
- Vista `v_ciclo_compras`: join SC → Cotización → OC → GR → Factura → CxP → Pago

### Fase 5 — COSO Segregación
- `recepciones_mercancia`: añadir role check (solo warehouse/manager pueden confirmar GR)
- `facturas_proveedor` 4-way match con diferencia: requiere `approved_by` manager
- Ambos via RLS policy + check en RPC existente

### Estado tablas (verificar en nueva sesión)
Migración base compras: `20260620000000_solicitudes_insumos_rpc.sql`
Última migración: `20260708100002_profiles_trigger.sql`
Nueva migración: `20260709000001_ciclo_compras_trazabilidad.sql`

### Instrucción nueva sesión
"Implementa Fase 1 trazabilidad BD y Fase 5 COSO del plan ciclo compras. Plan en memoria/proyectos/plan-ciclo-compras.md"
