export type TipoPersona = "fisica" | "moral";
export type IvaTratamiento = "sin_configurar" | "exento" | "tasa_0" | "tasa_general";

/** Códigos numéricos del catálogo de cuentas: 401=consultas, 402=farmacia, 403=otros ingresos. */
export type CodigoCuentaIngreso = "401" | "402" | "403";

/**
 * Clasificación de los 17 regímenes fiscales de REGIMENES (ConfiguracionCFDI.tsx)
 * por tipo de persona. null = aplica a ambos (física y moral), requiere selección
 * explícita del usuario — no se puede inferir solo de la clave SAT.
 */
export const REGIMEN_TIPO_PERSONA: Record<string, TipoPersona | null> = {
  "601": "moral",
  "603": "moral",
  "605": "fisica",
  "606": "fisica",
  "608": "fisica",
  "610": null,
  "611": "fisica",
  "612": "fisica",
  "614": "fisica",
  "616": "fisica",
  "620": "moral",
  "621": "fisica",
  "622": null,
  "623": "moral",
  "624": null,
  "625": "fisica",
  "626": null,
};

export function deriveIvaTratamiento(
  regimenFiscal: string,
  tipoPersona: TipoPersona | null,
  codigoCuenta: CodigoCuentaIngreso
): { tratamiento: IvaTratamiento; tasaPct: number | null } | null {
  if (codigoCuenta === "402") {
    return { tratamiento: "tasa_0", tasaPct: 0 };
  }

  if (tipoPersona === null) return null;

  if (codigoCuenta === "401") {
    return tipoPersona === "fisica"
      ? { tratamiento: "exento", tasaPct: null }
      : { tratamiento: "tasa_general", tasaPct: 16 };
  }

  // 403 = Otros ingresos
  return { tratamiento: "tasa_general", tasaPct: 16 };
}
