import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";

export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  activo: boolean;
  rfc: string;
  regimen_fiscal: string;
  domicilio_fiscal: string;
  clabe: string;
  banco: string;
  terminos_pago: number;
  plazo_entrega: number;
  requiere_cofepris: boolean;
  clasificacion: "critico" | "regular" | "ocasional";
  estatus_efos: "no_verificado" | "ok" | "alerta";
  ultima_verificacion_efos: string | null;
  notas: string;
  clasificacion_abc: "A" | "B" | "C";
  cuenta_clabe: string;
  banco_nombre: string;
  limite_credito_centavos: number;
  dias_credito: number;
  descuento_pronto_pago_pct: number;
  dias_pronto_pago: number;
}

export interface ProveedorInput {
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  activo: boolean;
  rfc: string;
  regimen_fiscal: string;
  domicilio_fiscal: string;
  clabe: string;
  banco: string;
  terminos_pago: number;
  plazo_entrega: number;
  requiere_cofepris: boolean;
  clasificacion: "critico" | "regular" | "ocasional";
  estatus_efos: "no_verificado" | "ok" | "alerta";
  notas: string;
  clasificacion_abc: "A" | "B" | "C";
  cuenta_clabe: string;
  banco_nombre: string;
  limite_credito_centavos: number;
  dias_credito: number;
  descuento_pronto_pago_pct: number;
  dias_pronto_pago: number;
}

interface ProveedorRow {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
  rfc: string | null;
  regimen_fiscal: string | null;
  domicilio_fiscal: string | null;
  clabe: string | null;
  banco: string | null;
  terminos_pago: number | null;
  plazo_entrega: number | null;
  requiere_cofepris: boolean | null;
  clasificacion: string | null;
  estatus_efos: string | null;
  ultima_verificacion_efos: string | null;
  notas: string | null;
  clasificacion_abc: string | null;
  cuenta_clabe: string | null;
  banco_nombre: string | null;
  limite_credito_centavos: number | null;
  dias_credito: number | null;
  descuento_pronto_pago_pct: number | null;
  dias_pronto_pago: number | null;
}

const toProveedor = (row: ProveedorRow): Proveedor => ({
  id: row.id,
  nombre: row.nombre,
  contacto: row.contacto ?? "",
  telefono: row.telefono ?? "",
  email: row.email ?? "",
  activo: row.activo,
  rfc: row.rfc ?? "",
  regimen_fiscal: row.regimen_fiscal ?? "",
  domicilio_fiscal: row.domicilio_fiscal ?? "",
  clabe: row.clabe ?? "",
  banco: row.banco ?? "",
  terminos_pago: row.terminos_pago ?? 30,
  plazo_entrega: row.plazo_entrega ?? 3,
  requiere_cofepris: row.requiere_cofepris ?? false,
  clasificacion: (row.clasificacion as Proveedor["clasificacion"]) ?? "regular",
  estatus_efos: (row.estatus_efos as Proveedor["estatus_efos"]) ?? "no_verificado",
  ultima_verificacion_efos: row.ultima_verificacion_efos ?? null,
  notas: row.notas ?? "",
  clasificacion_abc: (row.clasificacion_abc as Proveedor["clasificacion_abc"]) ?? "C",
  cuenta_clabe: row.cuenta_clabe ?? "",
  banco_nombre: row.banco_nombre ?? "",
  limite_credito_centavos: row.limite_credito_centavos ?? 0,
  dias_credito: row.dias_credito ?? 30,
  descuento_pronto_pago_pct: row.descuento_pronto_pago_pct ?? 0,
  dias_pronto_pago: row.dias_pronto_pago ?? 10,
});

const toRow = (input: ProveedorInput) => ({
  nombre: input.nombre.trim(),
  contacto: input.contacto.trim() || null,
  telefono: input.telefono.trim() || null,
  email: input.email.trim() || null,
  activo: input.activo,
  rfc: input.rfc.trim().toUpperCase() || null,
  regimen_fiscal: input.regimen_fiscal.trim() || null,
  domicilio_fiscal: input.domicilio_fiscal.trim() || null,
  clabe: input.clabe.replace(/\s/g, "") || null,
  banco: input.banco.trim() || null,
  terminos_pago: input.terminos_pago,
  plazo_entrega: input.plazo_entrega,
  requiere_cofepris: input.requiere_cofepris,
  clasificacion: input.clasificacion,
  estatus_efos: input.estatus_efos,
  notas: input.notas.trim() || null,
  clasificacion_abc: input.clasificacion_abc,
  cuenta_clabe: input.cuenta_clabe.replace(/\s/g, "") || null,
  banco_nombre: input.banco_nombre.trim() || null,
  limite_credito_centavos: input.limite_credito_centavos,
  dias_credito: input.dias_credito,
  descuento_pronto_pago_pct: input.descuento_pronto_pago_pct,
  dias_pronto_pago: input.dias_pronto_pago,
});

export const EMPTY_PROVEEDOR_INPUT: ProveedorInput = {
  nombre: "", contacto: "", telefono: "", email: "", activo: true,
  rfc: "", regimen_fiscal: "", domicilio_fiscal: "", clabe: "", banco: "",
  terminos_pago: 30, plazo_entrega: 3, requiere_cofepris: false,
  clasificacion: "regular", estatus_efos: "no_verificado", notas: "",
  clasificacion_abc: "C", cuenta_clabe: "", banco_nombre: "",
  limite_credito_centavos: 0, dias_credito: 30,
  descuento_pronto_pago_pct: 0, dias_pronto_pago: 10,
};

export function useProveedores(clinicId: string | null) {
  const [items, setItems] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await untypedTable("proveedores")
        .select("id, nombre, contacto, telefono, email, activo, rfc, regimen_fiscal, domicilio_fiscal, clabe, banco, terminos_pago, plazo_entrega, requiere_cofepris, clasificacion, estatus_efos, ultima_verificacion_efos, notas, clasificacion_abc, cuenta_clabe, banco_nombre, limite_credito_centavos, dias_credito, descuento_pronto_pago_pct, dias_pronto_pago")
        .eq("clinic_id", clinicId)
        .order("nombre");
      if (qErr) throw qErr;
      setItems(((data ?? []) as ProveedorRow[]).map(toProveedor));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar los proveedores."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: ProveedorInput) => {
      if (!clinicId) throw new Error("No hay clínica activa seleccionada.");
      const { error: cErr } = await untypedTable("proveedores").insert({
        ...toRow(input),
        clinic_id: clinicId,
      });
      if (cErr) throw new Error(friendlyError(cErr, "No se pudo crear el proveedor."));
      await load();
    },
    [clinicId, load],
  );

  const update = useCallback(
    async (id: string, input: ProveedorInput) => {
      const { error: uErr } = await untypedTable("proveedores").update(toRow(input)).eq("id", id);
      if (uErr) throw new Error(friendlyError(uErr, "No se pudo actualizar el proveedor."));
      await load();
    },
    [load],
  );

  const toggleActivo = useCallback(
    async (id: string, activo: boolean) => {
      const { error: tErr } = await untypedTable("proveedores").update({ activo }).eq("id", id);
      if (tErr) throw new Error(friendlyError(tErr, "No se pudo cambiar el estado."));
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: dErr } = await untypedTable("proveedores").delete().eq("id", id);
      if (dErr) throw new Error(friendlyError(dErr, "No se pudo eliminar el proveedor."));
      await load();
    },
    [load],
  );

  const marcarEfos = useCallback(
    async (id: string, estatus: Proveedor["estatus_efos"]) => {
      const { error: eErr } = await untypedTable("proveedores").update({
        estatus_efos: estatus,
        ultima_verificacion_efos: new Date().toISOString(),
      }).eq("id", id);
      if (eErr) throw new Error(friendlyError(eErr, "No se pudo actualizar el estatus EFOS."));
      await load();
    },
    [load],
  );

  return { items, loading, error, create, update, toggleActivo, remove, marcarEfos, refresh: load };
}
