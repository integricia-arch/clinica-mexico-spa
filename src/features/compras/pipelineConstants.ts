import type { EtapaPipeline, RolResponsable } from "@/hooks/usePipelineCompras";

export const ETAPA_LABEL: Record<EtapaPipeline, string> = {
  solicitud: "Solicitud",
  cotizacion: "Cotización",
  orden_compra: "Orden de Compra",
  recepcion: "Recepción",
  factura: "Factura",
  pago: "Completado",
};

export const ETAPA_ORDEN: EtapaPipeline[] = [
  "solicitud", "cotizacion", "orden_compra", "recepcion", "factura",
];

export const ROL_LABEL: Record<RolResponsable, string> = {
  compras: "Compras",
  gerencia: "Gerencia",
  almacen: "Almacén",
  finanzas: "Finanzas",
};

export const ROL_COLOR: Record<RolResponsable, string> = {
  compras: "bg-indigo-100 text-indigo-800",
  gerencia: "bg-amber-100 text-amber-800",
  almacen: "bg-teal-100 text-teal-800",
  finanzas: "bg-violet-100 text-violet-800",
};
