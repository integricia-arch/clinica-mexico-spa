import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

/**
 * Carga y guarda los datos de la sección "General" de /ajustes contra la
 * tabla `clinics`. Solo persiste las columnas que existen hoy en `clinics`;
 * moneda y logo se difieren (sin columna todavía).
 */

export interface GeneralForm {
  name: string;
  legalName: string;
  rfc: string;
  phone: string;
  email: string;
  /** Valor del <Select> de zona horaria: cdmx | cun | tij */
  timezone: string;
  address: string;
}

const EMPTY: GeneralForm = {
  name: "",
  legalName: "",
  rfc: "",
  phone: "",
  email: "",
  timezone: "cdmx",
  address: "",
};

// Mapeo entre el valor del Select y la columna text `clinics.timezone` (IANA).
const TZ_TO_IANA: Record<string, string> = {
  cdmx: "America/Mexico_City",
  cun: "America/Cancun",
  tij: "America/Tijuana",
};
const IANA_TO_TZ: Record<string, string> = Object.fromEntries(
  Object.entries(TZ_TO_IANA).map(([k, v]) => [v, k]),
);

interface UseClinicGeneralResult {
  form: GeneralForm;
  setField: <K extends keyof GeneralForm>(key: K, value: GeneralForm[K]) => void;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;
  save: () => Promise<void>;
  reset: () => void;
}

export function useClinicGeneral(clinicId: string | null): UseClinicGeneralResult {
  const [form, setForm] = useState<GeneralForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) {
      setForm(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("clinics")
        .select("name, legal_name, rfc, phone, email, timezone, address")
        .eq("id", clinicId)
        .maybeSingle();

      if (qErr) throw qErr;

      setForm({
        name: data?.name ?? "",
        legalName: data?.legal_name ?? "",
        rfc: data?.rfc ?? "",
        phone: data?.phone ?? "",
        email: data?.email ?? "",
        timezone: data?.timezone ? IANA_TO_TZ[data.timezone] ?? "cdmx" : "cdmx",
        address: data?.address ?? "",
      });
      setDirty(false);
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar los datos de la clínica."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = useCallback(
    <K extends keyof GeneralForm>(key: K, value: GeneralForm[K]) => {
      // Actualización inmutable: nuevo objeto, sin mutar el anterior.
      setForm((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    },
    [],
  );

  const save = useCallback(async () => {
    if (!clinicId) {
      setError("No hay clínica activa seleccionada.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: uErr } = await supabase
        .from("clinics")
        .update({
          name: form.name.trim(),
          legal_name: form.legalName.trim() || null,
          rfc: form.rfc.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          timezone: TZ_TO_IANA[form.timezone] ?? form.timezone,
          address: form.address.trim() || null,
        })
        .eq("id", clinicId);

      if (uErr) throw uErr;
      setDirty(false);
    } catch (e) {
      const msg = friendlyError(e as never, "No se pudieron guardar los cambios.");
      setError(msg);
      throw new Error(msg);
    } finally {
      setSaving(false);
    }
  }, [clinicId, form]);

  const reset = useCallback(() => {
    void load();
  }, [load]);

  return { form, setField, loading, saving, dirty, error, save, reset };
}
