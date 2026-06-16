---
tags: [proyecto, activo]
creado: 2026-06-09
---

# Proyecto — clinica-mexico-spa (Integriclinica)

Sistema de gestión para clínicas médicas en México. Multi-módulo, multi-clínica.

## Links rápidos
- [[STATE]] — estado actual y pendientes
- [[diario/2026-06-09]] — sesión de hoy

## Módulos implementados

### Farmacia / POS
`src/features/farmacia/`
- PuntoDeVenta, PaymentCapture, TicketInterno, ShiftPanel
- Turno farmacia: `pharmacy_cash_shifts`
- Ventas: `pharmacy_sales` + `pharmacy_sale_payments`
- Permisos granulares: `posPermissions()`

### Corte de Caja
`src/pages/CajaTurno.tsx`
- Turnos generales: tabla `turnos`
- Cortes: tabla `cortes` + `cortes_folio_seq`
- Fondos: tabla `fondos_movimientos`
- RPCs: `turno_close`, `turno_corte_x`, `turno_fondo_movimiento`

### Otros módulos
- Agenda / Citas
- Expedientes / Pacientes
- Recetas (controladas + normales)
- Camino del Paciente (flujo operativo)
- Telegram bot (webhook en Supabase Edge Functions)
- Auditoría (`audit_logs`, `pos_error_logs`)

## Decisiones arquitecturales
- [[conceptos/rpc-supabase]] — por qué usar RPCs para lógica de caja
- [[conceptos/corte-de-caja]] — arquitectura Opción B aprobada
- [[conceptos/iva-mexico]] — precios incluyen IVA, cálculo proporcional al descuento

## Contexto de negocio
- Clínicas en México
- Facturación: CFDI pendiente (futuro)
- IVA: 16% incluido en precio, algunos productos exentos
- Turnos: cajero abre turno con fondo inicial, cierra con corte Z
